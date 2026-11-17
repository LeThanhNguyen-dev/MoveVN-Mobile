import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import CodeDigitInput, { type CodeDigitInputHandle } from "@/components/CodeDigitInput";
import { PIN_DIGIT_COUNT } from "@/features/pin/services/pinErrorMessage";

export type PinDigitInputsHandle = CodeDigitInputHandle;

type PinDigitInputsProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
  showValue?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
};

const PinDigitInputs = forwardRef<PinDigitInputsHandle, PinDigitInputsProps>(function PinDigitInputs(
  {
    label,
    value,
    onChange,
    onComplete,
    showValue = false,
    hasError = false,
    autoFocus = false,
    disabled = false,
  },
  ref,
) {
  const { t } = useTranslation();
  return (
    <CodeDigitInput
      ref={ref}
      label={label}
      value={value}
      onChange={onChange}
      onComplete={() => onComplete?.()}
      length={PIN_DIGIT_COUNT}
      secure={!showValue}
      hasError={hasError}
      autoFocus={autoFocus}
      disabled={disabled}
      ariaLabelFor={(index) => t("accountSecurity:pin.digitAria", { label, index: index + 1 })}
    />
  );
});

export default PinDigitInputs;
