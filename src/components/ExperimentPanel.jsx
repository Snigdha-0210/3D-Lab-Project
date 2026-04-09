import { useState } from 'react';
import './ExperimentPanel.css';

export default function ExperimentPanel({
    currentStep,
    waterLevel,
    markedLevel,
    observations,
    onReset,
    onToggleZoom,
    isInMolecularView,
    canZoom,
}) {
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const steps = [
        '1. Take a 150 mL beaker (drag from sidebar)',
        '2. Fill the beaker with 100 mL water',
        '3. Mark the water level (automatically marked)',
        '4. Add salt, sugar, or sand to observe',
        '5. Use stirring rod to mix',
        '6. Observe changes in water level',
        '7. Zoom to see molecular view',
    ];

    const handleReset = () => {
        setShowResetConfirm(true);
    };

    const confirmReset = () => {
        setShowResetConfirm(false);
        onReset();
    };

    const cancelReset = () => {
        setShowResetConfirm(false);
    };

    return (
        <div className="experiment-panel">
            <div className="panel-section">
                <h3 className="section-title">
                    <span className="section-icon">📋</span>
                    Instructions
                </h3>
                <div className="steps-list">
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className={`step-item ${index <= currentStep ? 'step-active' : ''} ${index < currentStep ? 'step-complete' : ''
                                }`}
                        >
                            {index < currentStep && <span className="step-check">✓</span>}
                            {step}
                        </div>
                    ))}
                </div>
            </div>

            <div className="panel-section">
                <h3 className="section-title">
                    <span className="section-icon">🔬</span>
                    Measurements
                </h3>
                <div className="measurements">
                    <div className="measurement-item">
                        <span className="measurement-label">Water Level:</span>
                        <span className="measurement-value">{waterLevel.toFixed(1)} mL</span>
                    </div>
                    {markedLevel !== null && (
                        <div className="measurement-item">
                            <span className="measurement-label">Marked Level:</span>
                            <span className="measurement-value marked">{markedLevel.toFixed(1)} mL</span>
                        </div>
                    )}
                    {markedLevel !== null && waterLevel > markedLevel + 0.5 && (
                        <div className="measurement-alert">
                            ⚠️ Water level rose by {(waterLevel - markedLevel).toFixed(1)} mL
                        </div>
                    )}
                </div>
            </div>

            <div className="panel-section">
                <h3 className="section-title">
                    <span className="section-icon">👁️</span>
                    Observations
                </h3>
                <div className="observations-list">
                    {observations.length === 0 && (
                        <div className="observation-empty">No observations yet...</div>
                    )}
                    {observations.map((obs, index) => (
                        <div key={index} className="observation-item">
                            <span className="observation-time">{obs.time}</span>
                            <span className="observation-text">{obs.text}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="panel-section">
                <h3 className="section-title">
                    <span className="section-icon">🔍</span>
                    View Controls
                </h3>
                <button
                    className={`zoom-btn ${isInMolecularView ? 'zoom-active' : ''}`}
                    onClick={onToggleZoom}
                    disabled={!canZoom}
                    title={canZoom ? 'Toggle molecular view' : 'Add material to water first'}
                >
                    {isInMolecularView ? '🔙 Return to Normal View' : '🔬 Zoom to Molecular View'}
                </button>
                {isInMolecularView && (
                    <div className="molecular-info">
                        <p>You are now at molecular level!</p>
                        <p className="molecular-hint">
                            {canZoom === 'salt' || canZoom === 'sugar'
                                ? '💡 See how small ions fit between water molecules'
                                : '💡 See how sand particles are too large to dissolve'}
                        </p>
                    </div>
                )}
            </div>

            <div className="panel-section">
                <button className="reset-btn" onClick={handleReset}>
                    🔄 Reset Experiment
                </button>
            </div>

            {showResetConfirm && (
                <div className="modal-overlay" onClick={cancelReset}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Reset Experiment?</h3>
                        <p>This will clear all materials and reset the beaker.</p>
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={cancelReset}>
                                Cancel
                            </button>
                            <button className="modal-btn modal-btn-confirm" onClick={confirmReset}>
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
