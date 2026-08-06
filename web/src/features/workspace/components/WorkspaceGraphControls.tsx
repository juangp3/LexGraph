'use client';

import { ZoomIn, ZoomOut, Maximize, Download, Link2 } from 'lucide-react';
import { useReactFlow } from 'reactflow';
import { Button } from '@/components/ui/button';
import { toPng } from 'html-to-image';
import { useToast } from '@/components/ui/toast';

export function WorkspaceGraphControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const showToast = useToast();

  const handleDownload = async () => {
    const graphElement = document.querySelector<HTMLElement>('.react-flow');
    if (graphElement) {
      const dataUrl = await toPng(graphElement);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'lexgraph.png';
      a.click();
      showToast({ title: 'Export started', description: 'The graph snapshot is downloading now.' });
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    showToast({ title: 'Copied link', description: 'Current workspace URL copied to clipboard.' });
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="icon" onClick={() => zoomIn()}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={() => zoomOut()}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={() => fitView()}>
        <Maximize className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={handleCopyLink}>
        <Link2 className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={handleDownload}>
        <Download className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => window.dispatchEvent(new CustomEvent('lexgraph:centerSelection'))}
        title="Center selection (F)"
      >
        <Maximize className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => window.dispatchEvent(new CustomEvent('lexgraph:toggleMiniMap'))}
        title="Toggle Minimap"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
