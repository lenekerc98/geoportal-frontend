import React, { useState, useEffect } from 'react';

const SectorColorPickerButton = React.memo(({ sectorName, currentColor, isVisible, onColorChange }) => {
  const [localColor, setLocalColor] = useState(currentColor);

  useEffect(() => {
    setLocalColor(currentColor);
  }, [currentColor]);

  const handleInput = (e) => {
    const val = e.target.value;
    setLocalColor(val);
    onColorChange(sectorName, val, false);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalColor(val);
    onColorChange(sectorName, val, true);
  };

  return (
    <label
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        margin: 0,
        padding: 0,
        flexShrink: 0
      }}
      title="Clic para cambiar color de este sector"
      onClick={(e) => e.stopPropagation()}
    >
      <span
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '3px',
          backgroundColor: isVisible ? localColor : '#94a3b8',
          border: '1px solid rgba(0,0,0,0.2)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          display: 'inline-block'
        }}
      />
      <input
        type="color"
        value={localColor}
        onInput={handleInput}
        onChange={handleChange}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          border: 'none',
          padding: 0
        }}
      />
    </label>
  );
});

export default SectorColorPickerButton;

