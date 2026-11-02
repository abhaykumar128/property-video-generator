import React from 'react';

export default function Header() {
  return (
    <header className="site-header" role="banner">
      <a className="site-header__brand" href="/" aria-label="PropertyStudio AI home">
        <span className="site-header__logo" aria-hidden="true">🏡</span>
        <span>
          <span className="site-header__name">PropertyStudio AI</span>
          <span className="site-header__tagline"> — Turn property photos into ready-to-share videos</span>
        </span>
      </a>
      <span className="site-header__badge">Beta</span>
    </header>
  );
}
