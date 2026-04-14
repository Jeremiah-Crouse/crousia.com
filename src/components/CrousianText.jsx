import React, { lazy } from 'react';

const TexturedCrousianText = lazy(() => import('./TexturedCrousianText'));

export default function CrousianText(props) {
  return <TexturedCrousianText {...props} />;
}
