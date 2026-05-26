'use client';

import { useQRCode } from 'next-qrcode';

type Props = {
  value: string;
};

export function LinkQRCode({ value }: Props) {
  const { Canvas } = useQRCode();

  return (
    <Canvas
      text={value}
      options={{
        width: 180,
        margin: 2,
      }}
    />
  );
}