/// <reference types="node" />

declare namespace HTMLtoDOCX {
    interface Margins {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
        header?: number;
        footer?: number;
        gutter?: number;
    }

    interface PageSize {
        width?: number;
        height?: number;
    }

    interface Row {
        cantSplit?: boolean;
    }

    interface Table {
        row?: Row;
        borderOptions?: {
            size?: number;
            stroke?: string;
            color?: string;
        };
        addSpacingAfter?: boolean;
    }

    interface LineNumberOptions {
        start: number;
        countBy: number;
        restart: "continuous" | "newPage" | "newSection";
    }

    interface HeadingSpacing {
        before?: number;
        after?: number;
    }

    interface HeadingStyle {
        font?: string;
        fontSize?: number;
        bold?: boolean;
        spacing?: HeadingSpacing;
        keepLines?: boolean;
        keepNext?: boolean;
        outlineLevel?: number;
    }

    interface HeadingConfig {
        heading1?: HeadingStyle;
        heading2?: HeadingStyle;
        heading3?: HeadingStyle;
        heading4?: HeadingStyle;
        heading5?: HeadingStyle;
        heading6?: HeadingStyle;
    }

    type PaperSizeName =
        | "A4" | "A3" | "A5" | "B4" | "B5" | "Letter" | "Legal"
        | "A4 Small" | "Letter Small" | "Note" | "Tabloid" | "11x17"
        | "Statement" | "Executive" | "Folio" | "Quarto" | "10x14";

    /**
     * Nested page setup (hwp-convert 자매 정합). When present it takes precedence
     * over the legacy flat `orientation`/`pageSize`/`margins`.
     * NOTE: `page.margins` are in **mm** (unlike the legacy `margins`, which are TWIP).
     * Resolution precedence per field: page > legacy flat > @page CSS > container CSS > A4 default.
     */
    interface PageOption {
        /** Paper name (case-insensitive) or custom dimensions. */
        size?: PaperSizeName | { width: number; height: number; unit?: "mm" | "twip" };
        /** "auto" (default) decides landscape from container body width vs paper. */
        orientation?: "auto" | "portrait" | "landscape";
        /** Per-side page margins in **mm**. */
        margins?: {
            left?: number;
            right?: number;
            top?: number;
            bottom?: number;
            header?: number;
            footer?: number;
            gutter?: number;
        };
        /** Container CSS heuristic (root max-width/padding) is ON by default; set false to opt out. */
        autoDetectContainer?: boolean;
    }

    interface DocumentOptions {
        page?: PageOption;
        orientation?: "portrait" | "landscape";
        pageSize?: PageSize;
        margins?: Margins;
        title?: string;
        subject?: string;
        creator?: string;
        keywords?: string[];
        description?: string;
        lastModifiedBy?: string;
        revision?: number;
        createdAt?: Date;
        modifiedAt?: Date;
        headerType?: "default" | "first" | "even";
        header?: boolean;
        footerType?: "default" | "first" | "even";
        footer?: boolean;
        font?: string;
        fontSize?: number;
        complexScriptFontSize?: number;
        table?: Table;
        pageNumber?: boolean;
        skipFirstHeaderFooter?: boolean;
        lineNumber?: boolean;
        lineNumberOptions?: LineNumberOptions;
        numbering?: {
            defaultOrderedListStyleType?: string;
        };
        heading?: HeadingConfig;
        decodeUnicode?: boolean;
        lang?: string;
        direction?: "ltr" | "rtl";
        preprocessing?: {
            skipHTMLMinify?: boolean;
        };
        imageProcessing?: {
            maxRetries?: number;
            verboseLogging?: boolean;
            downloadTimeout?: number;
            maxImageSize?: number;
            retryDelayBase?: number;
            minTimeout?: number;
            maxTimeout?: number;
            minImageSize?: number;
            maxCacheSize?: number;
            maxCacheEntries?: number;
            svgHandling?: "convert" | "native" | "auto";
            suppressSharpWarning?: boolean;
        };
    }
}

declare function HTMLtoDOCX(
    htmlString: string,
    headerHTMLstring?: string | null,
    documentOptions?: HTMLtoDOCX.DocumentOptions,
    footerHtmlString?: string | null,
): Promise<ArrayBuffer | Blob | Buffer>;

export = HTMLtoDOCX;
