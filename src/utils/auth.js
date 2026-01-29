// Authentication utility functions

export const clearTokens = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("is_admin_session");
};

export const getTokens = () => {
  return {
    token: localStorage.getItem("token"),
    refreshToken: localStorage.getItem("refresh_token")
  };
};

export const setTokens = (token, refreshToken = null) => {
  if (token) {
    localStorage.setItem("token", token);
  }
  if (refreshToken) {
    localStorage.setItem("refresh_token", refreshToken);
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    console.error("Error checking token expiration:", error);
    return true; // Assume expired if we can't parse
  }
};

export const refreshAuthToken = async (API) => {
  const { refreshToken } = getTokens();
  
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }
  
  try {
    const response = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    
    if (!response.ok) {
      throw new Error("Token refresh failed");
    }
    
    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    
    return data.access_token;
  } catch (error) {
    console.error("Token refresh error:", error);
    clearTokens();
    throw error;
  }
};
