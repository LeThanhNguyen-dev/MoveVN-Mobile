/**
 * Item banner Homepage do Admin quản lý tại /admin/banners.
 * Mirror web `HomepageBanner` (MoveVN-FrontEnd/src/features/banners/types).
 * GET /api/banners/homepage chỉ trả banner IsActive + trong StartAt-EndAt,
 * sort theo DisplayOrder, kèm Promotion join (nếu có PromotionId).
 */
export interface HomepageBanner {
  id: number;
  title: string;
  /** Cột image_url (Cloudinary folder movevn/banners) — ảnh render slide 16:9. */
  imageUrl: string;
  promotionId?: number | null;
  promotionCode?: string | null;
  promotionName?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  vehicleType?: string | null;
  endAt?: string | null;
  popupTitle: string;
  popupDescription: string;
  popupCtaLabel: string;
  displayOrder: number;
}
