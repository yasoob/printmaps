import { POI_ADDRESS_REVIEW_PAGE_SIZE, poiAddressNameError, poiAddressQueryError, selectedPoiAddress, type PoiAddressReviewRow } from '../../domain/poiAddressReview';
import type { usePoiSpreadsheet } from '../hooks/usePoiSpreadsheet';

type Spreadsheet = ReturnType<typeof usePoiSpreadsheet>;

function rowStatus(row: PoiAddressReviewRow) {
  const candidate = selectedPoiAddress(row);
  if (candidate) return `Matched location: ${candidate.label}`;
  if (row.status === 'found') return 'Multiple locations found. Choose a match.';
  if (row.status === 'missing') return 'No matches found. Correct the address, retry, or exclude this row.';
  if (row.status === 'error') return `Lookup failed: ${row.error}`;
  if (row.status === 'stopped') return 'Lookup stopped. Look up this address again or exclude it.';
  if (row.status === 'loading') return 'Looking up this address…';
  if (row.status === 'queued') return 'Waiting for lookup…';
  return 'Address not checked. Look up this address before adding it.';
}

function MatchChoices({ row, model }: { row: PoiAddressReviewRow; model: Spreadsheet }) {
  if (row.candidates.length < 2) return null;
  return <label>Matched location
    <select aria-label={`Matched location for row ${row.id + 1}`} value={row.selected ?? ''} disabled={model.draft.lookup !== null} onChange={(event) => model.changeRow(row.id, { selected: event.target.value === '' ? null : Number(event.target.value) })}>
      <option value="">Choose a match</option>
      {row.candidates.map((match, index) => <option key={`${index}-${match.providerFeatureId}`} value={index}>{match.label}</option>)}
    </select>
  </label>;
}

function AddressRow({ row, model }: { row: PoiAddressReviewRow; model: Spreadsheet }) {
  const isBusy = model.draft.lookup !== null;
  const candidate = selectedPoiAddress(row);
  const nameError = poiAddressNameError(row.name);
  const queryError = poiAddressQueryError(row.address);
  const nameId = `poi-review-name-${row.id}`;
  const addressId = `poi-review-address-${row.id}`;
  return <li className="poi-address-row">
    <label className="poi-address-include">
      <input type="checkbox" checked={row.included} disabled={isBusy} aria-label={`Include row ${row.id + 1}: ${row.name}`} onChange={(event) => model.changeRow(row.id, { included: event.target.checked })} />
      <strong>{row.id + 1}. {row.name}</strong>
    </label>
    <p className="poi-address-query">Requested: {row.address}</p>
    <p className="poi-address-match">{rowStatus(row)}</p>
    {row.status === 'found' && !candidate && <p>First suggestion (not selected): {row.candidates[0]?.label}</p>}
    {candidate && <small>Longitude {candidate.center[0]}, latitude {candidate.center[1]}</small>}
    {!row.included && <p>Excluded — this row will not be added.</p>}
    <details>
      <summary>Review or correct row {row.id + 1}</summary>
      <div className="poi-address-fields">
        <label>POI name
          <input aria-label={`POI name for row ${row.id + 1}`} value={row.name} disabled={isBusy} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? nameId : undefined} onChange={(event) => model.changeRow(row.id, { name: event.target.value })} />
        </label>
        {nameError && <p id={nameId} className="poi-spreadsheet-error">{nameError}</p>}
        <label>Address to look up
          <textarea aria-label={`Address for row ${row.id + 1}`} value={row.address} disabled={isBusy} aria-invalid={Boolean(queryError)} aria-describedby={queryError ? addressId : undefined} onChange={(event) => model.changeRow(row.id, { address: event.target.value })} />
        </label>
        {queryError && <p id={addressId} className="poi-spreadsheet-error">{queryError}</p>}
        <MatchChoices row={row} model={model} />
        <button type="button" disabled={isBusy || Boolean(queryError)} onClick={() => model.retry(row.id)}>Look up row {row.id + 1} again</button>
      </div>
    </details>
  </li>;
}

export function PoiAddressReview({ model, onPageChange }: { model: Spreadsheet; onPageChange: (page: number) => void }) {
  const { rows, page, lookup } = model.draft;
  const pageCount = Math.max(1, Math.ceil(rows.length / POI_ADDRESS_REVIEW_PAGE_SIZE));
  const start = page * POI_ADDRESS_REVIEW_PAGE_SIZE;
  const selected = rows.filter((row) => row.included).length;
  return <section className="poi-address-review" aria-label="Address match review">
    <h3>Review matched locations</h3>
    <p>Review the returned locality. Suggestions are unverified; up to 5 matches per address.</p>
    <p>{selected} of {rows.length} rows included. Excluded rows will not be added or saved.</p>
    <ol start={start + 1} aria-label="Reviewed address rows">
      {rows.slice(start, start + POI_ADDRESS_REVIEW_PAGE_SIZE).map((row) => <AddressRow key={row.id} row={row} model={model} />)}
    </ol>
    {pageCount > 1 && <nav className="poi-address-pagination" aria-label="Address review pages">
      <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous addresses</button>
      <span>Rows {start + 1}–{Math.min(start + POI_ADDRESS_REVIEW_PAGE_SIZE, rows.length)} of {rows.length}</span>
      <button type="button" disabled={page + 1 >= pageCount} onClick={() => onPageChange(page + 1)}>Next addresses</button>
    </nav>}
    {!lookup && rows.some((row) => row.included && row.status !== 'found') && <button type="button" onClick={() => model.retry()}>Retry unfinished addresses</button>}
  </section>;
}
