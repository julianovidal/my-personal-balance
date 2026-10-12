import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const MENU_GAP_PX = 4;

type ActionsMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  menuClassName?: string;
};

function ActionsMenu({
  open,
  onOpenChange,
  trigger,
  children,
  className,
  menuClassName
}: ActionsMenuProps) {
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    const triggerEl = triggerRef.current;
    const panelEl = panelRef.current;
    if (!triggerEl || !panelEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const panelWidth = panelEl.offsetWidth;
    const panelHeight = panelEl.offsetHeight;
    const left = rect.right - panelWidth;
    let top = rect.bottom + MENU_GAP_PX;

    if (top + panelHeight > window.innerHeight) {
      top = rect.top - panelHeight - MENU_GAP_PX;
    }

    setCoords({ top, left });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition, children]);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-actions-menu-root="true"]')) {
        onOpenChange(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
  const triggerElement = trigger as React.ReactElement<TriggerProps>;
  const triggerNode = React.isValidElement(trigger)
    ? React.cloneElement(triggerElement, {
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          triggerElement.props.onClick?.(event);
          if (!event.defaultPrevented) {
            onOpenChange(!open);
          }
        },
        "aria-expanded": open,
        "aria-haspopup": "menu"
      })
    : trigger;

  return (
    <>
      <div
        ref={triggerRef}
        className={cn("relative inline-block", className)}
        data-actions-menu-root="true"
      >
        {triggerNode}
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              data-actions-menu-root="true"
              data-actions-menu-panel="true"
              className={cn(
                "fixed z-50 w-40 rounded-lg border border-border bg-card p-1 shadow-lg",
                menuClassName
              )}
              style={
                coords
                  ? { top: coords.top, left: coords.left, visibility: "visible" }
                  : { top: 0, left: 0, visibility: "hidden" }
              }
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export { ActionsMenu };
