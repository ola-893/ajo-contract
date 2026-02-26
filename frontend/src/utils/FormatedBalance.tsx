import React from "react";

interface FormattedBalanceProps {
  value: number | string;
  symbol: string;
  loading?: boolean;
  decimals?: number; // optional, default: no forced decimals
  className?: string;
}

const FormattedBalance: React.FC<FormattedBalanceProps> = ({
  value,
  symbol,
  loading = false,
  decimals,
  className = "text-primary",
}) => {
  if (loading) {
    return <span className={className}>Loading...</span>;
  }

  const num = Number(value);

  // Format number with commas + optional decimals
  const formatted =
    decimals !== undefined
      ? num.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : num.toLocaleString();

  return (
    <span className={className}>
      {formatted} {symbol}
    </span>
  );
};

export default FormattedBalance;
