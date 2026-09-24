import React from 'react';
import { Spinner } from 'reactstrap';

const LoadingIndicator = ({ size = 'md', color = 'primary', text = 'Loading...' }) => {
  return (
    <div className="text-center py-5">
      <Spinner color={color} size={size} />
      {text && <p className="mt-3 text-muted">{text}</p>}
    </div>
  );
};

export default LoadingIndicator;

