declare module '*.jpeg' {
  const value: any;
  export = value;
}
declare module '*.png' {
  const value: any;
  export = value;
}
// One lucide icon per file (see components/ui/icons.ts), typed like the package's own exports.
declare module 'lucide-react-native/dist/esm/icons/*' {
  const Icon: import('lucide-react-native').LucideIcon;
  export default Icon;
}
