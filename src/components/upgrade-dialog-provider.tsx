"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { UpgradeDialog } from "@/components/upgrade-dialog";

type Ctx = {
  openUpgradeDialog: () => void;
};

const UpgradeDialogContext = createContext<Ctx>({ openUpgradeDialog: () => {} });

export function useUpgradeDialog() {
  return useContext(UpgradeDialogContext);
}

export function UpgradeDialogProvider({
  children,
  currentPlan,
}: {
  children: ReactNode;
  currentPlan?: string;
}) {
  const [open, setOpen] = useState(false);
  const openUpgradeDialog = useCallback(() => setOpen(true), []);

  return (
    <UpgradeDialogContext.Provider value={{ openUpgradeDialog }}>
      {children}
      <UpgradeDialog
        open={open}
        onClose={() => setOpen(false)}
        currentPlan={currentPlan}
      />
    </UpgradeDialogContext.Provider>
  );
}
