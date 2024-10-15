import { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import authService from '../api/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const accessToken = authService.getCurrentUser();
    if (accessToken) {
      authService.getUserData(accessToken)
        .then(userData => {
          setUser(userData);
          setIsAuthenticated(true);
        })
        .catch(error => {
          console.error('Error fetching user data:', error);
          authService.logout();
        });
    }
  }, []);

  const login = async (username, password) => {
    try {
      const tokens = await authService.login(username, password);
      const userData = await authService.getUserData(tokens.access);
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
