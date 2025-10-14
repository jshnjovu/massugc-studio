import React, { useEffect } from 'react';
import { useStore } from '../store';

const DarkModeProvider = ({ children }) => {
  const darkMode = useStore(state => state.darkMode);

  useEffect(() => {
    // Apply dark mode class to the HTML tag
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return <>{children}</>;
};

export default DarkModeProvider; 