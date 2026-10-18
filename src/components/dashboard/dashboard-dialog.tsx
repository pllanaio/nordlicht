"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/** Keep the page stationary while a modal is open, including on touch browsers. */
export function useModalInteraction(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!active || !ref.current) return;
    const element = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollY = window.scrollY;
    const previous = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width, overflow: document.body.style.overflow };
    Object.assign(document.body.style, { position: "fixed", top: `-${scrollY}px`, width: "100%", overflow: "hidden" });
    const focusables = () => Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter((item) => item.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => (element.querySelector<HTMLElement>("[data-initial-focus]") ?? focusables()[0] ?? element).focus({ preventScroll: true }));
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const targets = focusables();
      const first = targets[0];
      const last = targets.at(-1);
      if (!first || !last) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    element.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("keydown", keydown);
      Object.assign(document.body.style, previous);
      window.scrollTo({ top: scrollY, behavior: "instant" });
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [active, ref]);
}

export function DashboardDialog({ children, labelledBy, onClose }: { children: ReactNode; labelledBy: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModalInteraction(ref, true, onClose);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="dashboard-dialog" aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>{children}</dialog>;
}
