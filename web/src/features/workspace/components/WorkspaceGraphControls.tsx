'use client';

import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  RotateCcw,
  MinusSquare,
  PlusSquare,
} from 'lucide-react';
import { useReactFlow } from 'reactflow';
import { Button } from '@/components/ui/button';
import { toPng } from 'html-to-image';

export function WorkspaceGraphControls() {
  const { fitView, zoomIn, zoomOut, getNodes, getEdges } = useReactFlow();

  const handleDownload = async () => {
    const graphElement = document.querySelector<HTMLElement>('.react-flow');
    if (graphElement) {
      const dataUrl = await toPng(graphElement);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'lexgraph.png';
      a.click();
    }
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
      <Button variant="outline" size="icon" onClick={handleDownload}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
