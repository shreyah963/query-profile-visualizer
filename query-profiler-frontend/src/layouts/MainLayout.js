import React from 'react';
import PropTypes from 'prop-types';
import './MainLayout.css';

const MainLayout = ({ children }) => {
  return (
    <div className="main-layout">
      <main className="main-content">
        {children}
      </main>
      <footer className="main-footer">
        <p>© {new Date().getFullYear()} Query Profiler. All rights reserved.</p>
      </footer>
    </div>
  );
};

MainLayout.propTypes = {
  children: PropTypes.node.isRequired
};

export default MainLayout; 