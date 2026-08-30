import { useState } from "react";
import { MAX_ARC_CURVATURE } from "../../domain/routeArcGeometry";
import { InputGroup, InputGroupAddon, InputNumber } from "./InputGroup";
import { PropertyRow } from "./PropertyControls";

type ArcCurvatureControlsProps = {
  curvatures: readonly number[];
  disabled: boolean;
  onChange: (segmentIndex: number, curvature: number) => void;
};

export function ArcCurvatureControls({
  curvatures,
  disabled,
  onChange,
}: ArcCurvatureControlsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const segmentIndex = Math.min(selectedIndex, curvatures.length - 1);
  const curvature = curvatures[segmentIndex] ?? 0;
  const [amountEdit, setAmountEdit] = useState(() => ({
    segmentIndex,
    source: curvature,
    value: String(Math.abs(curvature)),
  }));
  const amountDraft =
    amountEdit.segmentIndex === segmentIndex && amountEdit.source === curvature
      ? amountEdit.value
      : String(Math.abs(curvature));
  const amount = Number(amountDraft);
  const isInvalid =
    amountDraft.trim() === "" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > MAX_ARC_CURVATURE;
  const commitAmount = () => {
    if (isInvalid) {
      setAmountEdit({
        segmentIndex,
        source: curvature,
        value: String(Math.abs(curvature)),
      });
      return;
    }
    setAmountEdit({ segmentIndex, source: curvature, value: String(amount) });
    onChange(segmentIndex, amount * (curvature < 0 ? -1 : 1));
  };
  return (
    <>
      <PropertyRow label="Segment">
        <select
          aria-label="Arc segment"
          disabled={disabled}
          value={segmentIndex}
          onChange={(event) => {
            setSelectedIndex(Number(event.target.value));
          }}
        >
          {curvatures.map((_value, index) => (
            <option key={index} value={index}>
              Segment {index + 1}
            </option>
          ))}
        </select>
      </PropertyRow>
      <PropertyRow label="Bend">
        <InputGroup>
          <InputNumber
            aria-label="Arc curvature amount"
            aria-invalid={isInvalid || undefined}
            disabled={disabled}
            min={0}
            max={MAX_ARC_CURVATURE}
            step={0.05}
            value={amountDraft}
            onChange={(event) =>
              setAmountEdit({
                segmentIndex,
                source: curvature,
                value: event.target.value,
              })
            }
            onBlur={commitAmount}
          />
          <InputGroupAddon align="inline-end">×</InputGroupAddon>
        </InputGroup>
      </PropertyRow>
      <button
        type="button"
        aria-label="Flip arc direction"
        disabled={disabled || curvature === 0}
        onClick={() => onChange(segmentIndex, -curvature)}
      >
        Flip direction
      </button>
    </>
  );
}
