import React, { Suspense, lazy } from 'react';

const ImageCrousianText = lazy(() => import('./ImageCrousianText'));

export default function CrousianText(props) {
  return <ImageCrousianText {...props} />;
}
