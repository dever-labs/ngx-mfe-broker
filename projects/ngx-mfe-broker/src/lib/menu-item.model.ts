export interface MenuItem {
  /** Display label shown in the menu. */
  label: string;
  /** Router path this item navigates to. */
  path: string;
  /** Optional icon identifier (e.g. PrimeNG icon class). */
  icon?: string;
  /** Path to the remote entry JSON served by this micro-frontend. */
  remoteEntry?: string;
  /** Name of the Native Federation remote. */
  remoteName?: string;
  /** Exposed module to load from the remote. */
  exposedModule?: string;
  /** Nested child items. */
  children?: MenuItem[];
}
