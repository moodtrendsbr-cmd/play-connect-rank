import { useParams, Navigate } from "react-router-dom";

/**
 * Redirects /arena/dashboard/torneios/:id and /organizer/dashboard/eventos/:id
 * to the single tournament Central at /tournaments/:id/manage.
 */
export default function RedirectToManage() {
  const { id } = useParams();
  if (!id) return <Navigate to="/" replace />;
  return <Navigate to={`/tournaments/${id}/manage`} replace />;
}
