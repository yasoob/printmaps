# /// script
# requires-python = ">=3.11"
# dependencies = ["pyshp==2.3.1"]
# ///
"""Generate deterministic Natural Earth Admin 0/1 browser assets."""

from __future__ import annotations

import argparse
import ctypes
import errno
import hashlib
import json
import os
import re
import shutil
import tempfile
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

import shapefile


SOURCE_VERSION = "5.1.1"
SOURCE_LABEL = f"Natural Earth {SOURCE_VERSION}"
EXPECTED_ADMIN_0_FEATURES = 258
EXPECTED_ADMIN_1_FEATURES = 4_596
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
ADMINISTRATIVE_OUTPUT = REPOSITORY_ROOT / "public/data/administrative"
ADMIN_0 = {
    "basename": "ne_10m_admin_0_countries",
    "bytes": 4_930_492,
    "sha256": "ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6",
    "url": "https://naturalearth.s3.amazonaws.com/5.1.1/10m_cultural/ne_10m_admin_0_countries.zip",
}
ADMIN_1 = {
    "basename": "ne_10m_admin_1_states_provinces",
    "bytes": 14_909_524,
    "sha256": "efc59726337323058f9446210adc96673179cd344e053666ee3d28cb58ba2b05",
    "url": "https://naturalearth.s3.amazonaws.com/5.1.1/10m_cultural/ne_10m_admin_1_states_provinces.zip",
}


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(".cache/natural-earth") / SOURCE_VERSION)
    parser.add_argument("--output", type=Path, default=Path("public/data/administrative"))
    return parser.parse_args()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validated_output_path(output: Path) -> Path:
    resolved_output = output.resolve()
    if resolved_output != ADMINISTRATIVE_OUTPUT:
        raise ValueError(f"--output must be {ADMINISTRATIVE_OUTPUT}; refusing destructive replacement of {resolved_output}.")
    return resolved_output


def acquire_archive(cache: Path, source: dict[str, Any]) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    destination = cache / f"{source['basename']}.zip"
    if destination.exists() and (
        destination.stat().st_size != source["bytes"] or file_sha256(destination) != source["sha256"]
    ):
        destination.unlink()
    if not destination.exists():
        temporary = destination.with_suffix(".download")
        temporary.unlink(missing_ok=True)
        try:
            with urllib.request.urlopen(source["url"], timeout=60) as response, temporary.open("wb") as target:
                content_length = response.headers.get("Content-Length")
                if content_length is not None and int(content_length) > source["bytes"]:
                    raise ValueError(f"Oversized Content-Length for {destination.name}.")
                remaining = source["bytes"]
                while remaining:
                    block = response.read(min(1024 * 1024, remaining))
                    if not block:
                        break
                    target.write(block)
                    remaining -= len(block)
                if remaining or response.read(1):
                    raise ValueError(f"Byte-size mismatch for {destination.name}.")
            if file_sha256(temporary) != source["sha256"]:
                raise ValueError(f"Checksum mismatch for {destination.name}.")
            temporary.replace(destination)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
    return destination


def extract_shapefile(archive_path: Path, source: dict[str, Any], target: Path) -> Path:
    basename = source["basename"]
    with zipfile.ZipFile(archive_path) as archive:
        for suffix in (".cpg", ".dbf", ".shp", ".shx"):
            member = f"{basename}{suffix}"
            destination = target / member
            destination.write_bytes(archive.read(member))
    return target / f"{basename}.shp"


def normalized_geometry(shape: shapefile.Shape) -> dict[str, Any]:
    geometry = shape.__geo_interface__
    if geometry["type"] not in {"Polygon", "MultiPolygon"}:
        raise ValueError(f"Unsupported geometry type: {geometry['type']}")
    coordinates = json.loads(json.dumps(geometry["coordinates"], allow_nan=False))
    normalized = {"type": geometry["type"], "coordinates": coordinates}
    validate_geometry(normalized)
    return normalized


def geometry_rings(geometry: dict[str, Any]) -> Iterable[list[list[float]]]:
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    for polygon in polygons:
        yield from polygon


def validate_geometry(geometry: dict[str, Any]) -> None:
    rings = list(geometry_rings(geometry))
    if not rings:
        raise ValueError("Boundary geometry has no rings.")
    for ring in rings:
        if len(ring) < 4 or ring[0] != ring[-1]:
            raise ValueError("Boundary ring is empty or open.")
        for position in ring:
            if len(position) != 2:
                raise ValueError("Boundary position must contain longitude and latitude.")
            longitude, latitude = position
            if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
                raise ValueError("Boundary coordinate is outside longitude/latitude bounds.")
        doubled_area = sum(
            longitude * next_latitude - next_longitude * latitude
            for (longitude, latitude), (next_longitude, next_latitude) in zip(ring, ring[1:])
        )
        if doubled_area == 0:
            raise ValueError("Boundary ring has zero area.")


def geometry_bounds(geometry: dict[str, Any]) -> list[float]:
    positions = [position for ring in geometry_rings(geometry) for position in ring]
    return [
        min(position[0] for position in positions),
        min(position[1] for position in positions),
        max(position[0] for position in positions),
        max(position[1] for position in positions),
    ]


def validate_bounds(bounds: list[float]) -> None:
    minimum_longitude, minimum_latitude, maximum_longitude, maximum_latitude = bounds
    if not (
        -180 <= minimum_longitude <= maximum_longitude <= 180
        and -90 <= minimum_latitude <= maximum_latitude <= 90
    ):
        raise ValueError(f"Boundary bounds are invalid or unordered: {bounds}")


def source_identifier(prefix: str, record: dict[str, Any]) -> str:
    value = record.get("adm1_code") or record.get("NE_ID") or record.get("ne_id")
    if value in {None, "", -99, "-99"}:
        raise ValueError(f"Natural Earth {prefix} record is missing a stable source identifier.")
    return f"natural-earth:{prefix}:{value}"


def region_identifier(record: dict[str, Any], iso_counts: Counter[str], iso_country_codes: set[str]) -> str:
    iso_code = str(record.get("iso_3166_2", "")).strip().upper()
    iso_match = re.fullmatch(r"([A-Z]{2})-[A-Z0-9]{1,3}", iso_code)
    if iso_match and iso_match.group(1) in iso_country_codes and iso_counts[iso_code] == 1:
        return iso_code
    stable_code = str(record.get("adm1_code") or record.get("ne_id", "")).strip()
    if stable_code in {"", "-99"}:
        raise ValueError("Natural Earth Admin 1 record has no stable fallback identifier.")
    return f"NE-ADM1-{stable_code}"


def region_name(record: dict[str, Any]) -> str:
    name = str(record.get("name_en") or record.get("name") or "").strip()
    if name:
        return name
    note = str(record.get("note") or "").strip()
    if "(" in note and note.endswith(")"):
        name = note.rsplit("(", 1)[1][:-1].strip()
    if not name:
        raise ValueError(f"Natural Earth Admin 1 record {record.get('adm1_code')} has no display name.")
    return name


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )


def exchange_directories(left: Path, right: Path) -> None:
    """Atomically exchange two populated directories without a missing-path window."""
    rename_at_2 = getattr(ctypes.CDLL(None, use_errno=True), "renameat2", None)
    if rename_at_2 is None:
        raise OSError(errno.ENOSYS, "Atomic directory exchange is unavailable on this platform.")
    rename_at_2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename_at_2.restype = ctypes.c_int
    if rename_at_2(-100, os.fsencode(left), -100, os.fsencode(right), 2) != 0:
        error_number = ctypes.get_errno()
        raise OSError(error_number, os.strerror(error_number))


def read_records(path: Path) -> list[tuple[dict[str, Any], shapefile.Shape]]:
    reader = shapefile.Reader(str(path), encoding="utf-8")
    return [(shape_record.record.as_dict(), shape_record.shape) for shape_record in reader.iterShapeRecords()]


def build_assets(admin_0_path: Path, admin_1_path: Path, output: Path) -> None:
    countries = read_records(admin_0_path)
    regions = read_records(admin_1_path)
    if len(countries) != EXPECTED_ADMIN_0_FEATURES or len(regions) != EXPECTED_ADMIN_1_FEATURES:
        raise ValueError(
            f"Natural Earth coverage changed: expected {EXPECTED_ADMIN_0_FEATURES}/{EXPECTED_ADMIN_1_FEATURES} "
            f"Admin 0/Admin 1 features, received {len(countries)}/{len(regions)}."
        )
    iso_country_codes = {
        code
        for record, _ in countries
        if (code := str(record.get("ISO_A2", "")).strip().upper()) != "-99" and re.fullmatch(r"[A-Z]{2}", code)
    }
    iso_counts = Counter(str(record.get("iso_3166_2", "")).strip().upper() for record, _ in regions)
    regions_by_country: dict[str, list[dict[str, Any]]] = defaultdict(list)
    boundary_ids: set[str] = set()
    source_ids: set[str] = set()

    for record, shape in regions:
        country_id = str(record["adm0_a3"]).strip()
        boundary_id = region_identifier(record, iso_counts, iso_country_codes)
        if boundary_id in boundary_ids:
            raise ValueError(f"Duplicate generated boundary ID: {boundary_id}")
        boundary_ids.add(boundary_id)
        source_id = source_identifier("admin1", record)
        if source_id in source_ids:
            raise ValueError(f"Duplicate generated source ID: {source_id}")
        source_ids.add(source_id)
        regions_by_country[country_id].append({
            "geometry": normalized_geometry(shape),
            "id": boundary_id,
            "name": region_name(record),
            "sourceId": source_id,
        })

    index_entries: list[dict[str, Any]] = []
    country_shards: dict[str, dict[str, Any]] = {}
    for record, shape in countries:
        country_id = str(record["ADM0_A3"]).strip()
        if country_id in boundary_ids:
            raise ValueError(f"Duplicate generated boundary ID: {country_id}")
        boundary_ids.add(country_id)
        country_name = str(record.get("NAME_EN") or record["NAME"]).strip()
        country_regions = sorted(regions_by_country.get(country_id, []), key=lambda item: item["id"])
        country_geometry = normalized_geometry(shape)
        bounds = [float(value) for value in shape.bbox]
        validate_bounds(bounds)
        if bounds != geometry_bounds(country_geometry):
            raise ValueError(f"Natural Earth bounds do not match country geometry for {country_id}.")
        source_id = source_identifier("admin0", record)
        if source_id in source_ids:
            raise ValueError(f"Duplicate generated source ID: {source_id}")
        source_ids.add(source_id)
        country = {
            "geometry": country_geometry,
            "id": country_id,
            "name": country_name,
            "sourceId": source_id,
        }
        levels = ["country", "region"] if country_regions else ["country"]
        index_entries.append({
            "bounds": bounds,
            "id": country_id,
            "levels": levels,
            "name": country_name,
            "shard": f"countries/{country_id}.json",
        })
        country_shards[country_id] = {
            "country": country,
            "regions": country_regions,
            "schemaVersion": 1,
        }

    unknown_country_ids = set(regions_by_country) - set(country_shards)
    if unknown_country_ids or sum(len(shard["regions"]) for shard in country_shards.values()) != len(regions):
        raise ValueError(f"Admin 1 coverage contains unsharded country IDs: {sorted(unknown_country_ids)}")
    staging = Path(tempfile.mkdtemp(prefix="administrative-build-", dir=output.parent))
    try:
        (staging / "countries").mkdir()
        for country_id, shard in sorted(country_shards.items()):
            write_json(staging / "countries" / f"{country_id}.json", shard)
        write_json(staging / "index.json", {
            "countries": sorted(index_entries, key=lambda entry: entry["id"]),
            "schemaVersion": 1,
            "sourceVersion": SOURCE_LABEL,
        })
        write_json(staging / "manifest.json", {
            "generated": {"admin1Features": len(regions), "countries": len(countries)},
            "generation": {
                "coordinates": "Exact Natural Earth source coordinates",
                "idStrategy": "ISO 3166-2 when unique; stable Natural Earth source ID otherwise",
            },
            "schemaVersion": 1,
            "sources": {
                "admin0": {**ADMIN_0, "version": SOURCE_VERSION},
                "admin1": {**ADMIN_1, "version": SOURCE_VERSION},
            },
        })
        if output.exists():
            exchange_directories(staging, output)
            shutil.rmtree(staging)
        else:
            staging.replace(output)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def main() -> None:
    arguments = parse_arguments()
    arguments.output = validated_output_path(arguments.output)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    admin_0_archive = acquire_archive(arguments.cache, ADMIN_0)
    admin_1_archive = acquire_archive(arguments.cache, ADMIN_1)
    with tempfile.TemporaryDirectory(prefix="natural-earth-") as temporary_directory:
        temporary = Path(temporary_directory)
        admin_0_path = extract_shapefile(admin_0_archive, ADMIN_0, temporary)
        admin_1_path = extract_shapefile(admin_1_archive, ADMIN_1, temporary)
        build_assets(admin_0_path, admin_1_path, arguments.output)
    print(f"Generated {arguments.output} from verified Natural Earth {SOURCE_VERSION} archives.")


if __name__ == "__main__":
    main()