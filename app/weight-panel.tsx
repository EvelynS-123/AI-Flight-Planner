"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { type RouteWeights, moveWeightBoundary } from "./route-data";

type Props = {
  weights: RouteWeights;
  onChange: React.Dispatch<React.SetStateAction<RouteWeights>>;
  copy: any;
  onConfirm: () => void;
};

export function WeightPanel({ weights, onChange, copy, onConfirm }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const allocationBarRef = useRef<HTMLDivElement>(null);
  const activeBoundary = useRef<"price-interest" | "interest-directness" | null>(null);
  const dragBarRect = useRef<DOMRect | null>(null);
  const pendingBoundaryUpdate = useRef<{ boundary: "price-interest" | "interest-directness"; clientX: number } | null>(null);
  const boundaryFrame = useRef<number | null>(null);

  const handlesAreColliding = weights.interest <= 4;

  useEffect(() => {
    const continueDrag = (event: globalThis.PointerEvent) => {
      if (activeBoundary.current) queueBoundaryFromClientX(activeBoundary.current, event.clientX);
    };
    const endDrag = () => {
      if (!activeBoundary.current) return;
      flushBoundaryUpdate();
      activeBoundary.current = null;
      dragBarRect.current = null;
      setIsDragging(false);
    };
    window.addEventListener("pointermove", continueDrag);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", continueDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      if (boundaryFrame.current !== null) cancelAnimationFrame(boundaryFrame.current);
    };
  }, []);

  function updateBoundary(boundary: "price-interest" | "interest-directness", value: number) {
    onChange((prev) => moveWeightBoundary(prev, boundary, value));
  }

  function applyBoundaryFromClientX(boundary: "price-interest" | "interest-directness", clientX: number) {
    const bar = allocationBarRef.current;
    if (!bar) return;
    const rect = dragBarRect.current ?? bar.getBoundingClientRect();
    const value = ((clientX - rect.left) / rect.width) * 100;
    updateBoundary(boundary, value);
  }

  function queueBoundaryFromClientX(boundary: "price-interest" | "interest-directness", clientX: number) {
    pendingBoundaryUpdate.current = { boundary, clientX };
    if (boundaryFrame.current !== null) return;
    boundaryFrame.current = requestAnimationFrame(() => {
      boundaryFrame.current = null;
      const pending = pendingBoundaryUpdate.current;
      pendingBoundaryUpdate.current = null;
      if (pending) applyBoundaryFromClientX(pending.boundary, pending.clientX);
    });
  }

  function flushBoundaryUpdate() {
    if (boundaryFrame.current !== null) cancelAnimationFrame(boundaryFrame.current);
    boundaryFrame.current = null;
    const pending = pendingBoundaryUpdate.current;
    pendingBoundaryUpdate.current = null;
    if (pending) applyBoundaryFromClientX(pending.boundary, pending.clientX);
  }

  function startBoundaryDrag(boundary: "price-interest" | "interest-directness", event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    dragBarRect.current = allocationBarRef.current?.getBoundingClientRect() ?? null;
    setIsDragging(true);
    activeBoundary.current = boundary;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyBoundaryFromClientX(boundary, event.clientX);
  }

  function moveBoundaryFromKeyboard(boundary: "price-interest" | "interest-directness", event: KeyboardEvent<HTMLButtonElement>) {
    const current = boundary === "price-interest" ? weights.price : weights.price + weights.interest;
    const step = event.shiftKey ? 5 : 1;
    let next = current;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= step;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += step;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 100;
    else return;
    event.preventDefault();
    updateBoundary(boundary, next);
  }

  return (
    <div className={`weight-panel chat-weight-panel ${isDragging ? "dragging" : ""}`} aria-label={copy.weightAria}>
      <div className="weight-intro">
        <div><span>{copy.weightTitle}</span><strong>100%</strong></div>
        <p>{copy.weightHelp}</p>
      </div>
      <div className="allocation-control">
        <div className="allocation-stage">
          <div className="allocation-bar" ref={allocationBarRef} aria-hidden="true">
            <span className="allocation-price" style={{ width: `${weights.price}%` }} />
            <span className="allocation-interest" style={{ width: `${weights.interest}%` }} />
            <span className="allocation-directness" style={{ width: `${weights.directness}%` }} />
          </div>
          <button
            className={`allocation-handle price-interest-handle ${handlesAreColliding ? "colliding" : ""}`}
            type="button"
            role="slider"
            aria-label={copy.firstBoundary}
            aria-valuemin={0}
            aria-valuemax={100 - weights.directness}
            aria-valuenow={weights.price}
            style={{ left: `${weights.price}%` }}
            onPointerDown={(event) => startBoundaryDrag("price-interest", event)}
            onKeyDown={(event) => moveBoundaryFromKeyboard("price-interest", event)}
          />
          <button
            className={`allocation-handle interest-directness-handle ${handlesAreColliding ? "colliding" : ""}`}
            type="button"
            role="slider"
            aria-label={copy.secondBoundary}
            aria-valuemin={weights.price}
            aria-valuemax={100}
            aria-valuenow={weights.price + weights.interest}
            style={{ left: `${weights.price + weights.interest}%` }}
            onPointerDown={(event) => startBoundaryDrag("interest-directness", event)}
            onKeyDown={(event) => moveBoundaryFromKeyboard("interest-directness", event)}
          />
        </div>
        <div className="allocation-legend">
          <span className="price"><i>¥</i>{copy.cheapest}<strong>{weights.price}%</strong></span>
          <span className="interest"><i>✦</i>{copy.interesting}<strong>{weights.interest}%</strong></span>
          <span className="directness"><i>→</i>{copy.directest}<strong>{weights.directness}%</strong></span>
        </div>
      </div>
      <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
        <button className="search-button" onClick={onConfirm} type="button">
          Search Flights
        </button>
      </div>
    </div>
  );
}
