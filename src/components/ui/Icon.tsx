import { icons, type LucideProps } from "lucide-react";

/** Render a lucide icon by its PascalCase name, e.g. <Icon name="Rocket" />. */
export function Icon({ name, ...props }: { name?: string } & LucideProps) {
  const Cmp = (name && icons[name as keyof typeof icons]) || icons.Circle;
  return <Cmp {...props} />;
}
