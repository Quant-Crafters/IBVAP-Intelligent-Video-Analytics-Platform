import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation();

  const token = localStorage.getItem("ibvap_token");
  const storedUser = localStorage.getItem("ibvap_user");

  // No authentication information.
  if (!token || !storedUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  let user;

  try {
    user = JSON.parse(storedUser);
  } catch (error) {
    console.error("Invalid stored user data:", error);

    localStorage.removeItem("ibvap_token");
    localStorage.removeItem("ibvap_user");

    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role?.toLowerCase();

  // If this route has role restrictions,
  // verify the logged-in user's role.
  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(userRole)
  ) {
    // Send unauthorized users to the first page
    // available to their role.
    return <Navigate to="/live-overview" replace />;
  }

  return children;
}

export default ProtectedRoute;