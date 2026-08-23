interface LocalizedMeasurementProps {
  message: string;
  value: string;
}

export function LocalizedMeasurement({ message, value }: LocalizedMeasurementProps) {
  const placeholder = "{value}";
  const placeholderIndex = message.indexOf(placeholder);
  if (placeholderIndex < 0) {
    return <>{message} <span className="answer-measurement">{value}</span></>;
  }
  return (
    <>
      {message.slice(0, placeholderIndex)}
      <span className="answer-measurement">{value}</span>
      {message.slice(placeholderIndex + placeholder.length)}
    </>
  );
}
