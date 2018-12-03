import PropTypes from 'prop-types';
import React, { Children, createContext } from 'react';

import { StyledSubNav, StyledSubNavLeftContent } from './SubNav-styled';

import { getChildType } from '../utils/helpers';

const SubNavContext = createContext({
  subNavContext: {
    blue: undefined
  }
});

const SubNav = ({ children, blue, ...other }) => {
  const subNavContext = {
    blue
  };

  const getLeftContent = function() {
    return Children.toArray(children).filter(child => {
      return (
        getChildType(child) === 'SubNavTitle' ||
        getChildType(child) === 'SubNavList'
      );
    });
  };

  const getSubNavActions = function() {
    return Children.toArray(children).filter(child => {
      return getChildType(child) === 'SubNavActions';
    });
  };

  return (
    <SubNavContext.Provider value={{ subNavContext }}>
      <StyledSubNav blue={blue} {...other}>
        <StyledSubNavLeftContent>{getLeftContent()}</StyledSubNavLeftContent>
        {getSubNavActions()}
      </StyledSubNav>
    </SubNavContext.Provider>
  );
};

SubNav.propTypes = {
  /** Description TBD */
  children: PropTypes.node,
  /** Description TBD */
  blue: PropTypes.bool,
  /** If true, the gradient is applied on top of the image */
  overlayGradient: PropTypes.bool
};

SubNav.defaultProps = {
  overlayGradient: true
};

SubNav.displayName = 'SubNav';

export { SubNav as default, SubNavContext };
