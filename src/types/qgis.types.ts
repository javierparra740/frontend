export interface RenderOpts {
    extent?: [number, number, number, number]; // [xmin, ymin, xmax, ymax]
    width?: number;
    height?: number;
    dpi?: number;
}

export interface QgisLayer {
    name: string;
    toGeoJSON(): GeoJSON.FeatureCollection;
    render(canvas: HTMLCanvasElement, opts?: RenderOpts): Promise<void>;
}

export declare const QGIS: {
    open(buffer: ArrayBuffer, name?: string): Promise<QgisLayer>;
};