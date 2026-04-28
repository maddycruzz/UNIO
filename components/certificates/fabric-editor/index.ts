'use client';

// Main assembly of the Fabric.js design editor
export { default as FabricCanvas } from './FabricCanvas';
export { default as EditorToolbar } from './Toolbar';
export { default as PropertiesPanel } from './PropertiesPanel';
export { default as LayersPanel } from './LayersPanel';
export { default as TemplatesSidebar } from './TemplatesSidebar';
export { FabricProvider, useFabric } from './FabricContext';
export type { LayerItem } from './FabricContext';
