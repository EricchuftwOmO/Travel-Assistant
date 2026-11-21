// Shows an ApiError: its message plus every field problem the service listed.
export default function ErrorMessage({ error }) {
  if (!error) return null;
  const details = Array.isArray(error.details) ? error.details : [];
  return (
    <div className="alert alert-error" role="alert">
      <strong>{error.message}</strong>
      {details.length > 0 && (
        <ul>
          {details.map((detail) => (
            <li key={typeof detail === 'string' ? detail : JSON.stringify(detail)}>
              {typeof detail === 'string' ? detail : `${detail.field} ${detail.message}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
