export type CmsPageResponse = {
  id: number;
  slug: string;
  title: string;
  content: string;
  contentType: string | null;
  category: string | null;
  description: string | null;
  bannerImageUrl: string | null;
  displayOrder: number;
  status: string;
  publishedAt: string | null;
  version: number;
  isActive: boolean;
  updatedAt: string;
};

export type CmsPageNavigationItem = {
  slug: string;
  title: string;
  contentType: string | null;
  category: string | null;
  description: string | null;
};

export type CmsAccordionItem = {
  id: string;
  title: string;
  content: string;
};

export type CmsSection =
  | {
      kind: "richtext";
      id: string;
      title: string;
      html: string;
    }
  | {
      kind: "accordion";
      id: string;
      title: string;
      items: CmsAccordionItem[];
    };
