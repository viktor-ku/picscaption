import { Switch } from "@headlessui/react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: "sm" | "md";
}

export function Toggle({ checked, onChange, label, size = "md" }: ToggleProps) {
  const sizeClasses = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knobSizeClasses =
    size === "sm"
      ? "h-4 w-4 group-data-[checked]:translate-x-4"
      : "h-5 w-5 group-data-[checked]:translate-x-5";

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={checked}
        onChange={onChange}
        className={`group relative inline-flex ${sizeClasses} shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 data-[checked]:bg-primary`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block ${knobSizeClasses} translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </Switch>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </div>
  );
}
