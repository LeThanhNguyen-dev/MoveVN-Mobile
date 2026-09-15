import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Bike,
  CalendarDays,
  CalendarOff,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Gauge,
  Hash,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BusyPeriod, VehicleResponse } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import BlockedDateSheet from "@/features/vehicles/components/BlockedDateSheet";
import MyVehicleDetailSkeleton from "@/features/vehicles/components/MyVehicleDetailSkeleton";
import OwnerVehicleMap from "@/features/vehicles/components/OwnerVehicleMap";
import SurchargePolicySummary from "@/features/vehicles/components/SurchargePolicySummary";
import {
  canDeleteVehicle,
  canToggleStatus,
  canUploadReplacementDocument,
  formatMinPrice,
  formatVnd,
  getOwnerStatusLabel,
  vehicleTypeLabel,
} from "@/features/vehicles/ownerDisplay";
import { getVehicleErrorMessage } from "@/features/vehicles/vehicleDisplay";
import { getVehicleAvailability } from "@/features/vehicles/services/publicVehicleService";
import { formatPeriodPart, MONTHS_VI } from "@/features/vehicles/utils/rentalPeriod";
import {
  createBlockedDate,
  deleteBlockedDate,
  deleteVehicle,
  getBlockedDates,
  getVehicleById,
  toggleVehicleStatus,
  uploadVehicleDocument,
  type BlockedDateResponse,
} from "@/features/vehicles/services/vehicleService";

type Props = {
  vehicleId: number;
  onBack: () => void;
  onEdit: (vehicleId: number) => void;
  onDeleted: () => void;
};

const DOC_STATUS_LABEL: Record<string, string> = {
  Pending: "Chờ xử lý",
  Verified: "Đã xác thực",
  NeedMoreInfo: "Cần bổ sung",
  ManualReview: "Chờ nhân viên xem",
  Rejected: "Từ chối",
  Failed: "Lỗi xử lý",
};

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function expandRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = toDateKey(from);
  const end = toDateKey(to);
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(cur);
    const parts = cur.split("-").map(Number);
    const y = parts[0] ?? 2000;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    cur = dt.toISOString().slice(0, 10);
    guard += 1;
  }
  return out;
}

export default function MyVehicleDetailScreen({ vehicleId, onBack, onEdit, onDeleted }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [vehicle, setVehicle] = useState<VehicleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [blockedDates, setBlockedDates] = useState<BlockedDateResponse[]>([]);
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryViewer, setGalleryViewer] = useState(false);
  const [galleryViewerIndex, setGalleryViewerIndex] = useState(0);
  const galleryRef = useRef<FlatList>(null);
  const galleryViewerRef = useRef<FlatList>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [savingBlocked, setSavingBlocked] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [docViewer, setDocViewer] = useState(false);
  const [docViewerIndex, setDocViewerIndex] = useState(0);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getVehicleById(vehicleId);
      setVehicle(data ?? null);
      getBlockedDates(vehicleId).then(setBlockedDates).catch(() => undefined);
      getVehicleAvailability(vehicleId)
        .then((res) => setBusyPeriods(res?.busyPeriods ?? []))
        .catch(() => undefined);
    } catch {
      setError("Không tải được thông tin xe.");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle() {
    if (!vehicle || toggling) return;
    setToggling(true);
    try {
      await toggleVehicleStatus(vehicle.id);
      const updated = await getVehicleById(vehicle.id);
      if (updated) setVehicle(updated);
    } finally {
      setToggling(false);
    }
  }

  function handleDelete() {
    if (!vehicle) return;
    Alert.alert("Xóa xe", `Xóa ${vehicle.licensePlate}? Hành động này không thể hoàn tác.`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          setDeleting(true);
          deleteVehicle(vehicle.id)
            .then(() => onDeleted())
            .catch(() => setDeleting(false));
        },
      },
    ]);
  }

  async function handleAddBlocked(from: string, to: string, reason: string) {
    if (!vehicle || !from || !to) return;
    setSavingBlocked(true);
    try {
      const created = await createBlockedDate(vehicle.id, {
        dateFrom: from,
        dateTo: to,
        reason: reason || null,
      });
      if (created) setBlockedDates((prev) => [created, ...prev]);
      setBlockedOpen(false);
    } finally {
      setSavingBlocked(false);
    }
  }

  async function handleDeleteBlocked(id: number) {
    try {
      await deleteBlockedDate(id);
      setBlockedDates((prev) => prev.filter((b) => b.id !== id));
    } catch {
      // giữ nguyên
    }
  }

  async function handlePickDocument() {
    if (!vehicle) return;
    setDocError("");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploadingDoc(true);
    try {
      const updated = await uploadVehicleDocument(vehicle.id, {
        uri: asset.uri,
        name: asset.fileName ?? "cavet.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      if (updated) {
        setVehicle(updated);
      } else {
        const fresh = await getVehicleById(vehicle.id);
        if (fresh) setVehicle(fresh);
      }
    } catch (e) {
      setDocError(getVehicleErrorMessage(e));
    } finally {
      setUploadingDoc(false);
    }
  }

  const blockedSet = useMemo(
    () => new Set(blockedDates.flatMap((b) => expandRange(b.startDate, b.endDate))),
    [blockedDates],
  );
  const bookedPeriods = useMemo(
    () => busyPeriods.filter((b) => b.type === "booking"),
    [busyPeriods],
  );
  const bookedSet = useMemo(
    () => new Set(bookedPeriods.flatMap((b) => expandRange(b.startDate, b.endDate))),
    [bookedPeriods],
  );

  if (loading) {
    return <MyVehicleDetailSkeleton />;
  }

  if (error || !vehicle) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Không tìm thấy xe."}</Text>
        <Pressable onPress={onBack} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const VehicleIcon = vehicle.vehicleType === "Car" ? Car : Bike;
  const images = vehicle.images.length > 0 ? vehicle.images : [];
  const currentDoc = vehicle.documents.find((d) => d.isCurrent) ?? vehicle.documents[0];
  const showToggle = canToggleStatus(vehicle.status);
  const showDelete = canDeleteVehicle(vehicle.status);
  const showDocUpload = canUploadReplacementDocument(currentDoc?.verificationStatus);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.iconBtn}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <View style={styles.topTitleWrap}>
          <Text numberOfLines={1} style={styles.topTitle}>
            {vehicle.brandName} {vehicle.modelName}
          </Text>
          <Text style={styles.topSub}>
            {vehicle.licensePlate} · {getOwnerStatusLabel(vehicle.status)}
          </Text>
        </View>
        <Pressable onPress={() => onEdit(vehicle.id)} style={styles.editBtn}>
          <Pencil color={theme.onBrand} size={16} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 16) + (showDelete ? 76 : 16) }]}
        showsVerticalScrollIndicator={false}
      >
        {images.length > 0 ? (
          <View style={styles.gallery}>
            <FlatList
              ref={galleryRef}
              data={images}
              keyExtractor={(img) => String(img.id)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const w = Dimensions.get("window").width - 32;
                const idx = Math.round(e.nativeEvent.contentOffset.x / w);
                setGalleryIndex(Math.min(Math.max(idx, 0), images.length - 1));
              }}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => {
                    setGalleryViewerIndex(index);
                    setGalleryViewer(true);
                  }}
                  style={styles.pagerPage}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.mainImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              )}
            />
            {images[galleryIndex]?.isPrimary ? (
              <View style={styles.primaryTag}>
                <Text style={styles.primaryTagText}>Ảnh chính</Text>
              </View>
            ) : null}
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {galleryIndex + 1}/{images.length}
              </Text>
            </View>
            {images.length > 1 ? (
              <View style={styles.dots}>
                {images.map((img, idx) => (
                  <View key={img.id} style={[styles.dot, idx === galleryIndex && styles.dotActive]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.noImage}>
            <VehicleIcon color={theme.faint} size={40} />
            <Text style={styles.noImageText}>Chưa có hình ảnh xe</Text>
          </View>
        )}

        {showToggle ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, vehicle.status === "Approved" ? styles.statusOn : styles.statusOff]}>
              <View style={[styles.statusDot, vehicle.status === "Approved" ? styles.dotOn : styles.dotOff]} />
              <Text style={[styles.statusText, vehicle.status === "Approved" ? styles.statusTextOn : styles.statusTextOff]}>
                {vehicle.status === "Approved" ? "Đang cho thuê" : "Đang ẩn"}
              </Text>
            </View>
            <Switch
              value={vehicle.status === "Approved"}
              disabled={toggling}
              onValueChange={handleToggle}
              trackColor={{ false: theme.faint, true: theme.success }}
              thumbColor="#FFFFFF"
            />
          </View>
        ) : null}

        {vehicle.rejectionReason ? (
          <View style={styles.rejectBox}>
            <XCircle color={theme.danger} size={18} />
            <View style={styles.rejectTextWrap}>
              <Text style={styles.rejectTitle}>Xe đã bị từ chối</Text>
              <Text style={styles.rejectReason}>{vehicle.rejectionReason}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Giá thuê</Text>
          <Text style={styles.bigPrice}>{formatMinPrice(vehicle)}</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Tiền cọc</Text>
            <Text style={styles.kvVal}>
              {vehicle.depositPercent > 0 ? `${vehicle.depositPercent}% tổng tiền thuê` : "Không yêu cầu"}
            </Text>
          </View>
          {vehicle.securityRequiresDeposit ? (
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Thế chấp</Text>
              <Text style={styles.kvVal}>{formatVnd(vehicle.securityDepositAmount)}</Text>
            </View>
          ) : null}
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Loại xe</Text>
            <View style={styles.typePill}>
              <VehicleIcon color={theme.brand} size={13} />
              <Text style={styles.typePillText}>{vehicleTypeLabel(vehicle.vehicleType)}</Text>
            </View>
          </View>
          {vehicle.pricingMode === "Auto" ? (
            <View style={styles.autoBox}>
              <Text style={styles.autoTitle}>Giá tự động</Text>
              <Text style={styles.autoText}>
                Khung: {formatVnd(vehicle.autoMinPrice)} - {formatVnd(vehicle.autoMaxPrice)}/ngày
              </Text>
            </View>
          ) : null}
        </View>

        <SurchargePolicySummary policies={vehicle.surchargePolicies} showInactive />

        <View style={styles.card}>
          <View style={styles.infoHead}>
            <View style={styles.infoHeadLeft}>
              <View style={styles.infoIconTile}>
                <VehicleIcon color={theme.brand} size={16} />
              </View>
              <Text style={styles.cardTitle}>Thông tin xe</Text>
            </View>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{vehicleTypeLabel(vehicle.vehicleType)}</Text>
            </View>
          </View>

          <View style={styles.specRow}>
            <View style={styles.specLeft}>
              <Hash color={theme.muted} size={15} />
              <Text style={styles.kvKey}>Biển số</Text>
            </View>
            <Text style={styles.kvValStrong}>{vehicle.licensePlate}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.specRow}>
            <View style={styles.specLeft}>
              <Layers color={theme.muted} size={15} />
              <Text style={styles.kvKey}>Dòng xe</Text>
            </View>
            <View style={styles.specRight}>
              <Text style={styles.kvVal}>
                {vehicle.brandName} {vehicle.modelName}
              </Text>
              {vehicle.variantName ? <Text style={styles.specSub}>{vehicle.variantName}</Text> : null}
            </View>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.specRow}>
            <View style={styles.specLeft}>
              <CalendarDays color={theme.muted} size={15} />
              <Text style={styles.kvKey}>Năm sản xuất</Text>
            </View>
            <Text style={styles.kvVal}>{vehicle.year}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.specRow}>
            <View style={styles.specLeft}>
              <Gauge color={theme.muted} size={15} />
              <Text style={styles.kvKey}>Số km đã đi</Text>
            </View>
            <Text style={styles.kvVal}>
              {vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString("vi-VN")} km` : "—"}
            </Text>
          </View>

          {vehicle.description ? (
            <View style={styles.descWrap}>
              <Text style={styles.descTitle}>Mô tả xe</Text>
              <Text style={styles.desc}>{vehicle.description}</Text>
            </View>
          ) : null}
          {vehicle.features.length > 0 ? (
            <View style={styles.featureWrap}>
              <Text style={styles.featureTitle}>Tính năng ({vehicle.features.length})</Text>
              <View style={styles.chips}>
                {vehicle.features.map((f) => (
                  <View key={f.id} style={styles.chip}>
                    <CheckCircle2 color={theme.brand} size={12} />
                    <Text style={styles.chipText}>{f.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <OwnerVehicleMap
            latitude={vehicle.latitude}
            longitude={vehicle.longitude}
            address={vehicle.address}
            title={`${vehicle.brandName} ${vehicle.modelName}`}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <CalendarOff color={theme.muted} size={15} />
              <Text style={styles.cardTitle}>Lịch xe ({blockedDates.length} chặn)</Text>
            </View>
            <Pressable onPress={() => setBlockedOpen(true)} style={styles.miniBtn}>
              <Plus color={theme.brand} size={14} />
              <Text style={styles.miniBtnText}>Chặn ngày</Text>
            </Pressable>
          </View>

          <View style={styles.miniCal}>
            <View style={styles.miniCalHead}>
              <Pressable
                onPress={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else setCalMonth((m) => m - 1);
                }}
                style={styles.miniCalNav}
              >
                <Text style={styles.miniCalNavText}>‹</Text>
              </Pressable>
              <Text style={styles.miniCalTitle}>
                {MONTHS_VI[calMonth]} {calYear}
              </Text>
              <Pressable
                onPress={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear((y) => y + 1);
                  } else setCalMonth((m) => m + 1);
                }}
                style={styles.miniCalNav}
              >
                <Text style={styles.miniCalNavText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.miniCalGrid}>
              {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d) => (
                <Text key={d} style={styles.miniCalWeek}>
                  {d}
                </Text>
              ))}
              {(() => {
                const first = new Date(calYear, calMonth, 1).getDay();
                const count = new Date(calYear, calMonth + 1, 0).getDate();
                const todayKey = new Date().toISOString().slice(0, 10);
                const nodes = [];
                for (let i = 0; i < first; i += 1) nodes.push(<View key={`e-${i}`} style={styles.miniCalCell} />);
                for (let d = 1; d <= count; d += 1) {
                  const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const isBlocked = blockedSet.has(key);
                  const isBooked = bookedSet.has(key);
                  const isPast = key < todayKey;
                  nodes.push(
                    <View key={d} style={styles.miniCalCell}>
                      <View
                        style={[
                          styles.miniCalDay,
                          isBlocked && styles.miniCalBlocked,
                          !isBlocked && isBooked && styles.miniCalBooked,
                        ]}
                      >
                        <Text
                          style={[
                            styles.miniCalDayText,
                            isPast && styles.miniCalPast,
                            isBlocked && styles.miniCalBlockedText,
                            !isBlocked && isBooked && styles.miniCalBookedText,
                          ]}
                        >
                          {d}
                        </Text>
                      </View>
                    </View>,
                  );
                }
                return nodes;
              })()}
            </View>
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendBlocked]} />
              <Text style={styles.legendText}>Đã chặn ({blockedSet.size})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendBooked]} />
              <Text style={styles.legendText}>Đã đặt ({bookedSet.size})</Text>
            </View>
          </View>
          {blockedDates.length === 0 ? (
            <Text style={styles.muted}>Chưa có ngày chặn nào.</Text>
          ) : (
            <View style={styles.blockedList}>
              {blockedDates.map((b) => (
                <View key={b.id} style={styles.blockedRow}>
                  <View style={styles.blockedInfo}>
                    <Text style={styles.blockedDates}>
                      {new Date(b.startDate).toLocaleDateString("vi-VN")} -{" "}
                      {new Date(b.endDate).toLocaleDateString("vi-VN")}
                    </Text>
                    {b.reason ? <Text style={styles.blockedReason}>{b.reason}</Text> : null}
                  </View>
                  <Pressable onPress={() => handleDeleteBlocked(b.id)} style={styles.trashBtn}>
                    <Trash2 color={theme.danger} size={16} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {bookedPeriods.length > 0 ? (
            <View style={styles.bookedWrap}>
              <Text style={styles.bookedTitle}>Ngày đã có người đặt ({bookedPeriods.length})</Text>
              <View style={styles.blockedList}>
                {bookedPeriods.map((b, idx) => (
                  <View key={`${b.startDate}-${b.endDate}-${idx}`} style={styles.bookedRow}>
                    <View style={styles.bookedDot} />
                    <Text style={styles.bookedText}>
                      {formatPeriodPart(b.startDate)} → {formatPeriodPart(b.endDate)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {currentDoc ? (
          <View style={styles.card}>
            <View style={styles.rowLeft}>
              <FileText color={theme.muted} size={15} />
              <Text style={styles.cardTitle}>Giấy tờ xe</Text>
            </View>
            <View style={styles.docTopRow}>
              <View style={styles.docBadge}>
                <Text style={styles.docBadgeText}>
                  {DOC_STATUS_LABEL[currentDoc.verificationStatus] ?? currentDoc.verificationStatus}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  const idx = Math.max(
                    0,
                    vehicle.documents.findIndex((d) => d.fileUrl === currentDoc.fileUrl),
                  );
                  setDocViewerIndex(idx);
                  setDocViewer(true);
                }}
                style={styles.viewCavetBtn}
              >
                <Eye color={theme.brand} size={14} />
                <Text style={styles.viewCavetText}>Xem cavet</Text>
              </Pressable>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Biển số OCR</Text>
              <Text style={styles.kvVal}>{currentDoc.ocrLicensePlate ?? "-"}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Hãng / Dòng</Text>
              <Text style={styles.kvVal}>
                {(currentDoc.ocrBrand ?? "-") + " / " + (currentDoc.ocrModel ?? "-")}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Số máy</Text>
              <Text style={styles.kvVal}>{currentDoc.ocrEngineNumber ?? "-"}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Số khung</Text>
              <Text style={styles.kvVal}>{currentDoc.ocrChassisNumber ?? "-"}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Độ tin cậy</Text>
              <Text style={styles.kvVal}>
                {currentDoc.ocrConfidence != null ? `${Math.round(currentDoc.ocrConfidence * 100)}%` : "-"}
              </Text>
            </View>
            {currentDoc.decisionReason ? (
              <Text style={styles.docReason}>{currentDoc.decisionReason}</Text>
            ) : null}
            {showDocUpload ? (
              <Pressable
                onPress={handlePickDocument}
                disabled={uploadingDoc}
                style={[styles.primaryBtn, uploadingDoc && styles.disabledBtn]}
              >
                <Text style={styles.primaryText}>
                  {uploadingDoc ? "Đang gửi..." : "Chọn ảnh cavet & gửi xác thực lại"}
                </Text>
              </Pressable>
            ) : null}
            {docError ? <Text style={styles.errorText}>{docError}</Text> : null}
            {vehicle.documents.length > 1 ? (
              <View style={styles.docHistory}>
                <Text style={styles.docHistoryTitle}>Lịch sử giấy tờ ({vehicle.documents.length})</Text>
                {vehicle.documents
                  .filter((d) => d.id !== currentDoc.id)
                  .map((d, idx) => (
                    <View key={d.id} style={styles.docHistoryRow}>
                      <FileText color={theme.faint} size={14} />
                      <Text style={styles.docHistoryLabel}>Lần {idx + 2}</Text>
                      <View style={styles.docHistoryBadge}>
                        <Text style={styles.docHistoryBadgeText}>
                          {DOC_STATUS_LABEL[d.verificationStatus] ?? d.verificationStatus}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          const i = Math.max(
                            0,
                            vehicle.documents.findIndex((x) => x.fileUrl === d.fileUrl),
                          );
                          setDocViewerIndex(i);
                          setDocViewer(true);
                        }}
                        style={styles.docHistoryView}
                      >
                        <Eye color={theme.brand} size={15} />
                      </Pressable>
                    </View>
                  ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {showDelete ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={[styles.dangerBtn, deleting && styles.disabledBtn]}
          >
            <Trash2 color={theme.danger} size={15} />
            <Text style={styles.dangerText}>{deleting ? "Đang xóa..." : "Xóa xe"}</Text>
          </Pressable>
        </View>
      ) : null}

      <BlockedDateSheet
        visible={blockedOpen}
        blockedKeys={blockedSet}
        bookedKeys={bookedSet}
        saving={savingBlocked}
        onClose={() => setBlockedOpen(false)}
        onConfirm={handleAddBlocked}
      />

      <Modal visible={galleryViewer} transparent animationType="fade" onRequestClose={() => setGalleryViewer(false)}>
        <View style={styles.viewerOverlay}>
          <View style={[styles.viewerHead, { paddingTop: Math.max(insets.top, 12) }]}>
            <Text style={styles.viewerTitle}>
              Hình ảnh xe {galleryViewerIndex + 1}/{images.length}
            </Text>
            <Pressable onPress={() => setGalleryViewer(false)} style={styles.viewerClose}>
              <X color="#FFF" size={20} />
            </Pressable>
          </View>
          <FlatList
            ref={galleryViewerRef}
            data={images}
            keyExtractor={(img) => String(img.id)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={galleryViewerIndex}
            getItemLayout={(_, index) => ({
              length: Dimensions.get("window").width,
              offset: Dimensions.get("window").width * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const w = Dimensions.get("window").width;
              const idx = Math.round(e.nativeEvent.contentOffset.x / w);
              setGalleryViewerIndex(Math.min(Math.max(idx, 0), images.length - 1));
            }}
            renderItem={({ item }) => (
              <View style={styles.viewerPage}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.viewerImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            )}
          />
          <View style={[styles.viewerNav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              disabled={galleryViewerIndex <= 0}
              onPress={() => {
                const next = Math.max(0, galleryViewerIndex - 1);
                setGalleryViewerIndex(next);
                galleryViewerRef.current?.scrollToIndex({ index: next, animated: true });
              }}
              style={[styles.viewerNavBtn, galleryViewerIndex <= 0 && styles.viewerNavDisabled]}
            >
              <ChevronLeft color="#FFF" size={22} />
            </Pressable>
            <Pressable
              disabled={galleryViewerIndex >= images.length - 1}
              onPress={() => {
                const next = Math.min(images.length - 1, galleryViewerIndex + 1);
                setGalleryViewerIndex(next);
                galleryViewerRef.current?.scrollToIndex({ index: next, animated: true });
              }}
              style={[styles.viewerNavBtn, galleryViewerIndex >= images.length - 1 && styles.viewerNavDisabled]}
            >
              <ChevronRight color="#FFF" size={22} />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={docViewer} transparent animationType="fade" onRequestClose={() => setDocViewer(false)}>
        <View style={styles.viewerOverlay}>
          <View style={[styles.viewerHead, { paddingTop: Math.max(insets.top, 12) }]}>
            <Text style={styles.viewerTitle}>
              Cavet xe {docViewerIndex + 1}/{vehicle.documents.length}
            </Text>
            <Pressable onPress={() => setDocViewer(false)} style={styles.viewerClose}>
              <X color="#FFF" size={20} />
            </Pressable>
          </View>
          {vehicle.documents[docViewerIndex] ? (
            <Image
              source={{ uri: vehicle.documents[docViewerIndex].fileUrl }}
              style={styles.viewerImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : null}
          {vehicle.documents.length > 1 ? (
            <View style={[styles.viewerNav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable
                disabled={docViewerIndex <= 0}
                onPress={() => setDocViewerIndex((i) => Math.max(0, i - 1))}
                style={[styles.viewerNavBtn, docViewerIndex <= 0 && styles.viewerNavDisabled]}
              >
                <ChevronLeft color="#FFF" size={22} />
              </Pressable>
              <Pressable
                disabled={docViewerIndex >= vehicle.documents.length - 1}
                onPress={() => setDocViewerIndex((i) => Math.min(vehicle.documents.length - 1, i + 1))}
                style={[styles.viewerNavBtn, docViewerIndex >= vehicle.documents.length - 1 && styles.viewerNavDisabled]}
              >
                <ChevronRight color="#FFF" size={22} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
    muted: { color: theme.muted, fontSize: 13 },
    errorText: { color: theme.danger, fontSize: 13, fontWeight: "600", textAlign: "center" },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitleWrap: { flex: 1, gap: 2 },
    topTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    topSub: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    editBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: { padding: 16, gap: 12 },
    gallery: { position: "relative" },
    pagerPage: { width: Dimensions.get("window").width - 32 },
    mainImage: { width: "100%", aspectRatio: 16 / 10, borderRadius: 16, backgroundColor: theme.surfaceAlt },
    primaryTag: {
      position: "absolute",
      left: 10,
      top: 10,
      backgroundColor: theme.brand,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    primaryTagText: { color: theme.onBrand, fontSize: 11, fontWeight: "800" },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    statusBadge: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
    statusOn: { backgroundColor: theme.successSoft },
    statusOff: { backgroundColor: theme.surfaceAlt },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    dotOn: { backgroundColor: theme.success },
    dotOff: { backgroundColor: theme.faint },
    statusText: { fontSize: 13, fontWeight: "800" },
    statusTextOn: { color: theme.success },
    statusTextOff: { color: theme.muted },
    thumbs: { gap: 8 },
    counterBadge: {
      position: "absolute",
      right: 10,
      bottom: 24,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    counterText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
    dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.border },
    dotActive: { width: 18, backgroundColor: theme.brand },
    noImage: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      aspectRatio: 16 / 9,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    noImageText: { color: theme.faint, fontSize: 13, fontWeight: "600" },
    rejectBox: {
      flexDirection: "row",
      gap: 10,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.dangerBorder,
      backgroundColor: theme.dangerSoft,
      padding: 12,
    },
    rejectTextWrap: { flex: 1, gap: 4 },
    rejectTitle: { color: theme.danger, fontSize: 13, fontWeight: "800" },
    rejectReason: { color: theme.danger, fontSize: 12, lineHeight: 18 },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 10,
    },
    cardTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    bigPrice: { color: theme.brand, fontSize: 22, fontWeight: "800" },
    kvRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    kvKey: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    kvVal: { color: theme.text, fontSize: 13, fontWeight: "600", textAlign: "right", flexShrink: 1 },
    kvValStrong: { color: theme.text, fontSize: 14, fontWeight: "800" },
    typePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    typePillText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    infoCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 4,
    },
    infoHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    infoHeadLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    infoIconTile: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    specRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 9 },
    specLeft: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 0 },
    specRight: { alignItems: "flex-end", flexShrink: 1 },
    specSub: { color: theme.faint, fontSize: 11, fontWeight: "600" },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
    descWrap: { gap: 5, paddingTop: 10 },
    descTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    featureWrap: { gap: 8 },
    featureTitle: { color: theme.text, fontSize: 12, fontWeight: "800" },
    autoBox: { borderRadius: 12, backgroundColor: theme.brandSoft, padding: 10, gap: 4 },
    autoTitle: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    autoText: { color: theme.brand, fontSize: 12 },
    desc: { color: theme.muted, fontSize: 13, lineHeight: 20 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipText: { color: theme.brand, fontSize: 12, fontWeight: "700" },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    miniBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    miniBtnText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    legend: { flexDirection: "row", gap: 14 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendBlocked: { backgroundColor: theme.danger },
    legendBooked: { backgroundColor: "#F59E0B" },
    legendText: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    blockedList: { gap: 8 },
    blockedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 10,
    },
    blockedInfo: { flex: 1, gap: 2 },
    blockedDates: { color: theme.text, fontSize: 13, fontWeight: "700" },
    blockedReason: { color: theme.muted, fontSize: 12 },
    trashBtn: { padding: 6 },
    docBadge: {
      borderRadius: 999,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    docBadgeText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    docTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    viewCavetBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    viewCavetText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    docHistory: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider, paddingTop: 10 },
    docHistoryTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    docHistoryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    docHistoryLabel: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    docHistoryBadge: { flex: 1, alignItems: "flex-start" },
    docHistoryBadgeText: { color: theme.muted, fontSize: 11, fontWeight: "700" },
    docHistoryView: { padding: 6 },
    viewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
    viewerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
    viewerTitle: { color: "#FFF", fontSize: 14, fontWeight: "800" },
    viewerClose: { padding: 8 },
    viewerImage: { flex: 1, width: "100%" },
    viewerPage: { width: Dimensions.get("window").width },
    viewerNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 8 },
    viewerNavBtn: { padding: 10 },
    viewerNavDisabled: { opacity: 0.3 },
    docReason: { color: theme.danger, fontSize: 12, lineHeight: 18 },
    bottomBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    dangerBtn: {
      height: 46,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.dangerBorder,
      backgroundColor: theme.dangerSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    dangerText: { color: theme.danger, fontSize: 14, fontWeight: "800" },
    primaryBtn: {
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    primaryText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
    disabledBtn: { opacity: 0.55 },
    miniCal: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      padding: 10,
    },
    miniCalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    miniCalNav: { padding: 6 },
    miniCalNavText: { color: theme.muted, fontSize: 20, fontWeight: "800" },
    miniCalTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    miniCalGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
    miniCalWeek: { width: "14.28%", textAlign: "center", color: theme.faint, fontSize: 10, fontWeight: "700", paddingVertical: 4 },
    miniCalCell: { width: "14.28%", alignItems: "center", paddingVertical: 2 },
    miniCalDay: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    miniCalDayText: { color: theme.text, fontSize: 12, fontWeight: "500" },
    miniCalPast: { color: theme.faint },
    miniCalBlocked: { backgroundColor: theme.dangerSoft },
    miniCalBlockedText: { color: theme.danger, fontWeight: "700" },
    miniCalBooked: { backgroundColor: "#FEF3C7" },
    miniCalBookedText: { color: "#B45309", fontWeight: "700" },
    bookedWrap: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider, paddingTop: 10 },
    bookedTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
    bookedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    bookedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B" },
    bookedText: { color: theme.text, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  });
