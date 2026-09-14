import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Bike, Car, Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  CatalogArea,
  CatalogBrand,
  CatalogFeature,
  CatalogModel,
  CatalogVariant,
  PricingSuggestionResponse,
  VehiclePricingResponse,
} from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import FormDropdownSheet from "@/features/vehicles/components/FormDropdownSheet";
import { getVehicleErrorMessage } from "@/features/vehicles/vehicleDisplay";
import {
  createVehicle,
  getCatalogAreas,
  getCatalogBrands,
  getCatalogFeatures,
  getCatalogModels,
  getCatalogVariants,
  getPricingSuggestion,
  getVehicleById,
  getVehiclePricing,
  updateVehicle,
  updateVehiclePricing,
  uploadVehicleDocument,
  uploadVehicleImage,
} from "@/features/vehicles/services/vehicleService";

type Props = {
  mode: "add" | "edit";
  vehicleId?: number;
  onBack: () => void;
  onDone: () => void;
};

const STEPS = ["Loại xe", "Hãng & dòng", "Thông tin", "Giá & địa chỉ", "Tính năng", "Hình ảnh", "Xác nhận"];

export default function MyVehicleWizardScreen({ mode, vehicleId, onBack, onDone }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEdit = mode === "edit";

  const [step, setStep] = useState(isEdit ? 3 : 0);
  const [maxReached, setMaxReached] = useState(isEdit ? 3 : 0);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [vehicleType, setVehicleType] = useState("");
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [modelId, setModelId] = useState<number | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [lockedNames, setLockedNames] = useState({ brand: "", model: "", variant: "" });

  const [year, setYear] = useState("2025");
  const [licensePlate, setLicensePlate] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");

  const [areas, setAreas] = useState<CatalogArea[]>([]);
  const [province, setProvince] = useState("");
  const [areaId, setAreaId] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<PricingSuggestionResponse | null>(null);
  const [pricingMode, setPricingMode] = useState<"Fixed" | "Auto">("Fixed");
  const [fixedPrice, setFixedPrice] = useState("");
  const [autoMin, setAutoMin] = useState("");
  const [autoMax, setAutoMax] = useState("");
  const [depositPercent, setDepositPercent] = useState("20");
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  const [features, setFeatures] = useState<CatalogFeature[]>([]);
  const [featureIds, setFeatureIds] = useState<number[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [docMime, setDocMime] = useState<string | null>(null);

  useEffect(() => {
    getCatalogAreas().then(setAreas).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEdit || !vehicleId) return;
    setLoadingEdit(true);
    Promise.all([getVehicleById(vehicleId), getVehiclePricing(vehicleId).catch(() => null)])
      .then(([v, pricing]: [Awaited<ReturnType<typeof getVehicleById>>, VehiclePricingResponse | null]) => {
        if (!v) return;
        setVehicleType(v.vehicleType);
        setBrandId(v.brandId);
        setModelId(v.modelId);
        setVariantId(v.variantId);
        setLockedNames({
          brand: v.brandName,
          model: v.modelName,
          variant: v.variantName ?? "",
        });
        setYear(String(v.year));
        setLicensePlate(v.licensePlate);
        setOdometerKm(v.odometerKm != null ? String(v.odometerKm) : "");
        setDescription(v.description ?? "");
        setAddress(v.address);
        setAreaId(v.areaId);
        const prov = areas.find((a) => a.id === v.areaId)?.province ?? "";
        if (prov) setProvince(prov);
        const mode = pricing?.pricingMode ?? v.pricingMode ?? "Fixed";
        setPricingMode(mode);
        setFixedPrice(String(pricing?.fixedPricePerDay ?? v.fixedPricePerDay ?? v.pricePerDay));
        setAutoMin(String(pricing?.autoMinPrice ?? v.autoMinPrice ?? ""));
        setAutoMax(String(pricing?.autoMaxPrice ?? v.autoMaxPrice ?? ""));
        setDepositPercent(String(v.depositPercent || 20));
        setRequiresDeposit(v.securityRequiresDeposit);
        setDepositAmount(v.securityDepositAmount ? String(v.securityDepositAmount) : "");
        setFeatureIds(v.features.map((f) => f.id));
        setImageUrls(v.images.map((i) => i.imageUrl));
        setFeaturedIndex(Math.max(0, v.images.findIndex((i) => i.isPrimary)));
        getCatalogFeatures(v.vehicleType).then(setFeatures).catch(() => undefined);
      })
      .finally(() => setLoadingEdit(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, vehicleId]);

  // edit: khi areas về sau, suy ra tỉnh từ areaId
  useEffect(() => {
    if (!isEdit || province || !areaId) return;
    const prov = areas.find((a) => a.id === areaId)?.province;
    if (prov) setProvince(prov);
  }, [areas, areaId, isEdit, province]);

  useEffect(() => {
    if (isEdit || !vehicleType) return;
    getCatalogBrands(vehicleType).then(setBrands).catch(() => undefined);
    getCatalogFeatures(vehicleType).then(setFeatures).catch(() => undefined);
    setBrandId(null);
    setModelId(null);
    setVariantId(null);
  }, [vehicleType, isEdit]);

  useEffect(() => {
    if (!brandId || isEdit) {
      if (!brandId) setModels([]);
      return;
    }
    getCatalogModels(brandId).then(setModels).catch(() => undefined);
  }, [brandId, isEdit]);

  useEffect(() => {
    if (!modelId || isEdit) {
      if (!modelId) setVariants([]);
      return;
    }
    getCatalogVariants(modelId, vehicleType).then(setVariants).catch(() => undefined);
  }, [modelId, vehicleType, isEdit]);

  useEffect(() => {
    if (!modelId || !areaId) {
      setSuggestion(null);
      return;
    }
    getPricingSuggestion(modelId, areaId).then((r) => setSuggestion(r ?? null)).catch(() => undefined);
  }, [modelId, areaId]);

  // Auto: prefill khung gợi ý khi đổi mode / gợi ý mới về
  useEffect(() => {
    if (
      pricingMode === "Auto" &&
      suggestion?.hasSuggestion &&
      suggestion.suggestedMinPrice != null &&
      suggestion.suggestedMaxPrice != null &&
      !isEdit
    ) {
      setAutoMin(String(suggestion.suggestedMinPrice));
      setAutoMax(String(suggestion.suggestedMaxPrice));
    }
  }, [pricingMode, suggestion, isEdit]);

  const provinces = useMemo(() => [...new Set(areas.map((a) => a.province))].sort(), [areas]);
  const provinceAreas = useMemo(
    () => areas.filter((a) => a.province === province).sort((a, b) => a.district.localeCompare(b.district)),
    [areas, province],
  );

  function isPriceInSuggestion(value: number) {
    if (!suggestion?.hasSuggestion || suggestion.suggestedMinPrice == null || suggestion.suggestedMaxPrice == null) return true;
    return value >= suggestion.suggestedMinPrice && value <= suggestion.suggestedMaxPrice;
  }

  function isPricingValid() {
    if (!areaId) return false;
    if (pricingMode === "Fixed") {
      const fixed = Number(fixedPrice);
      return fixed > 0 && isPriceInSuggestion(fixed);
    }
    const min = Number(autoMin);
    const max = Number(autoMax);
    return min > 0 && max > 0 && min <= max && isPriceInSuggestion(min) && isPriceInSuggestion(max);
  }

  function toggleFeature(id: number) {
    setFeatureIds((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  async function handlePickImages() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: Math.max(1, 10 - imageUrls.length),
    });
    if (res.canceled) return;
    setUploadingImage(true);
    try {
      for (const asset of res.assets) {
        const url = await uploadVehicleImage({
          uri: asset.uri,
          name: asset.fileName ?? "vehicle.jpg",
          type: asset.mimeType ?? "image/jpeg",
        });
        if (url) setImageUrls((prev) => [...prev, url]);
      }
    } finally {
      setUploadingImage(false);
    }
  }

  async function handlePickDoc() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    setDocUri(res.assets[0].uri);
    setDocName(res.assets[0].fileName ?? "cavet.jpg");
    setDocMime(res.assets[0].mimeType ?? "image/jpeg");
  }

  function goStep(next: number) {
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return vehicleType !== "";
      case 1:
        return brandId != null && modelId != null;
      case 2:
        return year.trim() !== "" && licensePlate.trim() !== "";
      case 3: {
        const dep = Number(depositPercent);
        return (
          address.trim() !== "" && isPricingValid() && dep >= 20 && dep <= 50 && (!requiresDeposit || Number(depositAmount) > 0)
        );
      }
      case 4:
        return true;
      case 5:
        return isEdit || imageUrls.length > 0;
      default:
        return true;
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const pricePerDay = pricingMode === "Fixed" ? Number(fixedPrice) : Number(autoMin);
      if (isEdit && vehicleId) {
        await updateVehicle(vehicleId, {
          year: Number(year) || 2025,
          licensePlate: licensePlate.trim(),
          odometerKm: odometerKm ? Number(odometerKm) : null,
          description: description.trim() || null,
          address: address.trim(),
          areaId,
          pricePerDay,
          depositPercent: Number(depositPercent),
          securityRequiresDeposit: requiresDeposit,
          securityDepositAmount: requiresDeposit ? Number(depositAmount) : 0,
          featureIds: featureIds,
        });
        await updateVehiclePricing(vehicleId, {
          pricingMode,
          fixedPricePerDay: pricingMode === "Fixed" ? Number(fixedPrice) : null,
          autoMinPrice: pricingMode === "Auto" ? Number(autoMin) : null,
          autoMaxPrice: pricingMode === "Auto" ? Number(autoMax) : null,
        });
        onDone();
        return;
      }
      const created = await createVehicle({
        brandId: brandId!,
        modelId: modelId!,
        variantId,
        vehicleType,
        year: Number(year) || 2025,
        licensePlate: licensePlate.trim(),
        odometerKm: odometerKm ? Number(odometerKm) : null,
        description: description.trim() || null,
        address: address.trim(),
        areaId,
        pricePerDay,
        depositPercent: Number(depositPercent),
        securityRequiresDeposit: requiresDeposit,
        securityDepositAmount: requiresDeposit ? Number(depositAmount) : 0,
        pricingMode,
        fixedPricePerDay: pricingMode === "Fixed" ? Number(fixedPrice) : null,
        autoMinPrice: pricingMode === "Auto" ? Number(autoMin) : null,
        autoMaxPrice: pricingMode === "Auto" ? Number(autoMax) : null,
        featureIds,
        imageUrls,
        featuredImageIndex: featuredIndex,
        documentFileUrl: null,
      });
      if (created?.id && docUri) {
        await uploadVehicleDocument(created.id, {
          uri: docUri,
          name: docName ?? "cavet.jpg",
          type: docMime ?? "image/jpeg",
        });
      }
      onDone();
    } catch (e) {
      setSubmitError(getVehicleErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingEdit) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.brand} size="large" />
      </View>
    );
  }

  const priceSummary =
    pricingMode === "Fixed"
      ? Number(fixedPrice) > 0
        ? `từ ${Number(fixedPrice).toLocaleString("vi-VN")}đ/ngày`
        : "-"
      : Number(autoMin) > 0 && Number(autoMax) > 0
        ? `từ ${Number(autoMin).toLocaleString("vi-VN")}đ/ngày (khung ${Number(autoMin).toLocaleString("vi-VN")} - ${Number(autoMax).toLocaleString("vi-VN")}đ)`
        : "-";

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.iconBtn}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text style={styles.topTitle}>{isEdit ? "Sửa xe" : "Thêm xe mới"}</Text>
        <Text style={styles.stepCount}>
          {step + 1}/{STEPS.length}
        </Text>
      </View>

      <View style={styles.stepper}>
        <View style={styles.stepLine} />
        <View style={styles.stepDots}>
          {STEPS.map((label, idx) => {
            const done = idx < step || idx < maxReached;
            const current = idx === step;
            const locked = isEdit && idx < 2;
            return (
              <Pressable
                key={label}
                disabled={locked || idx > maxReached}
                onPress={() => goStep(idx)}
                style={styles.stepItem}
              >
                <View
                  style={[
                    styles.stepDot,
                    done && !current && styles.stepDotDone,
                    current && styles.stepDotCurrent,
                  ]}
                >
                  {done && !current ? (
                    <Check color={theme.onBrand} size={12} />
                  ) : (
                    <Text style={[styles.stepNum, current && styles.stepNumCurrent]}>{idx + 1}</Text>
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.stepLabel, current && styles.stepLabelCurrent]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <View>
            <Text style={styles.groupTitle}>Chọn loại xe</Text>
            <Text style={styles.groupSub}>Bạn muốn cho thuê loại xe nào?</Text>
            {isEdit ? (
              <View style={styles.lockedBox}>
                <Text style={styles.lockedText}>
                  {vehicleType === "Car" ? "Ô tô" : "Xe máy"} (không thể đổi sau khi tạo)
                </Text>
              </View>
            ) : (
              <View style={styles.typeRow}>
                {[
                  { value: "Car", label: "Ô tô", hint: "Sedan, SUV, hatchback...", Icon: Car },
                  { value: "Motorbike", label: "Xe máy", hint: "Tay ga, xe số...", Icon: Bike },
                ].map((t) => {
                  const active = vehicleType === t.value;
                  return (
                    <Pressable
                      key={t.value}
                      onPress={() => setVehicleType(t.value)}
                      style={[styles.typeCard, active && styles.typeCardActive]}
                    >
                      {active ? (
                        <View style={styles.typeCheck}>
                          <Check color={theme.onBrand} size={12} />
                        </View>
                      ) : null}
                      <t.Icon color={active ? theme.brand : theme.faint} size={40} />
                      <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t.label}</Text>
                      <Text style={styles.typeHint}>{t.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>Hãng & dòng xe</Text>
            <Text style={styles.groupSub}>Chọn thông tin cơ bản của xe.</Text>
            {isEdit ? (
              <View style={styles.lockedBox}>
                <Text style={styles.lockedText}>
                  {lockedNames.brand} {lockedNames.model}
                  {lockedNames.variant ? ` · ${lockedNames.variant}` : ""} (không thể đổi sau khi tạo)
                </Text>
              </View>
            ) : (
              <>
                <FormDropdownSheet
                  label="Hãng xe"
                  placeholder="Chọn hãng xe"
                  value={brandId != null ? String(brandId) : ""}
                  options={brands.map((b) => ({ value: String(b.id), label: b.name }))}
                  onChange={(v) => {
                    setBrandId(Number(v));
                    setModelId(null);
                    setVariantId(null);
                  }}
                />
                {brandId ? (
                  <FormDropdownSheet
                    label="Dòng xe"
                    placeholder="Chọn dòng xe"
                    value={modelId != null ? String(modelId) : ""}
                    options={models.map((m) => ({ value: String(m.id), label: m.name }))}
                    onChange={(v) => {
                      setModelId(Number(v));
                      setVariantId(null);
                    }}
                  />
                ) : null}
                {modelId && variants.length > 0 ? (
                  <FormDropdownSheet
                    label="Phiên bản (không bắt buộc)"
                    placeholder="Chọn phiên bản"
                    value={variantId != null ? String(variantId) : ""}
                    options={variants.map((v) => ({
                      value: String(v.id),
                      label: v.name,
                      hint: [v.seatCount ? `${v.seatCount} chỗ` : "", v.transmission ?? "", v.fuelType ?? ""]
                        .filter(Boolean)
                        .join(" · "),
                    }))}
                    onChange={(v) => setVariantId(Number(v))}
                  />
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>Thông tin xe</Text>
            <Text style={styles.groupSub}>Nhập các thông số cơ bản của xe.</Text>
            <Text style={styles.fieldLabel}>Biển số xe *</Text>
            <TextInput
              value={licensePlate}
              onChangeText={setLicensePlate}
              placeholder="VD: 51A-12345"
              placeholderTextColor={theme.placeholder}
              style={styles.input}
              autoCapitalize="characters"
            />
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Năm sản xuất</Text>
                <TextInput value={year} onChangeText={setYear} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Số km đã đi</Text>
                <TextInput
                  value={odometerKm}
                  onChangeText={setOdometerKm}
                  keyboardType="numeric"
                  placeholder="15000"
                  placeholderTextColor={theme.placeholder}
                  style={styles.input}
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>Giá & địa chỉ</Text>
            <Text style={styles.groupSub}>Thiết lập giá cho thuê và vị trí xe.</Text>
            <FormDropdownSheet
              label="Tỉnh/Thành phố"
              placeholder="Chọn tỉnh/thành phố"
              value={province}
              options={provinces.map((p) => ({ value: p, label: p }))}
              onChange={(v) => {
                setProvince(v);
                setAreaId(null);
                setFixedPrice("");
                setAutoMin("");
                setAutoMax("");
              }}
            />
            <FormDropdownSheet
              label="Phường/Xã"
              placeholder={province ? "Chọn phường/xã" : "Chọn tỉnh trước"}
              value={areaId != null ? String(areaId) : ""}
              options={provinceAreas.map((a) => ({
                value: String(a.id),
                label: a.district,
                hint: `Vùng giá ${a.pricingRegionCode}`,
              }))}
              onChange={(v) => {
                setAreaId(Number(v));
                setFixedPrice("");
                setAutoMin("");
                setAutoMax("");
              }}
              disabled={!province}
            />
            <Text style={styles.fieldLabel}>Địa chỉ chi tiết *</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Số nhà, đường..."
              placeholderTextColor={theme.placeholder}
              style={styles.input}
            />

            {suggestion?.hasSuggestion ? (
              <View style={styles.suggestBox}>
                <Text style={styles.suggestTitle}>Gợi ý giá động</Text>
                <Text style={styles.suggestText}>
                  Khung: {suggestion.suggestedMinPrice?.toLocaleString("vi-VN")}đ -{" "}
                  {suggestion.suggestedMaxPrice?.toLocaleString("vi-VN")}đ/ngày (cơ sở:{" "}
                  {suggestion.basePrice?.toLocaleString("vi-VN")}đ)
                </Text>
                {suggestion.dynamicSuggestedPrice != null ? (
                  <Text style={styles.suggestHot}>
                    Đề xuất hôm nay: {suggestion.dynamicSuggestedPrice.toLocaleString("vi-VN")}đ
                    {suggestion.dynamicPricingMultiplier != null ? ` (x${suggestion.dynamicPricingMultiplier})` : ""}
                  </Text>
                ) : null}
                {(suggestion.dynamicIsWeekend || suggestion.dynamicIsHoliday || suggestion.dynamicIsLowVacancy) ? (
                  <Text style={styles.suggestFlags}>
                    {[suggestion.dynamicIsWeekend ? "Cuối tuần" : "", suggestion.dynamicIsHoliday ? "Ngày lễ" : "", suggestion.dynamicIsLowVacancy ? "Ít xe trống" : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : null}
              </View>
            ) : areaId ? (
              <View style={styles.suggestEmpty}>
                <Text style={styles.suggestEmptyText}>Chưa có khung giá gợi ý cho dòng xe và khu vực này.</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Hình thức định giá</Text>
            <View style={styles.modeRow}>
              {(["Fixed", "Auto"] as const).map((m) => {
                const active = pricingMode === m;
                const autoDisabled = m === "Auto" && !suggestion?.hasSuggestion;
                return (
                  <Pressable
                    key={m}
                    disabled={autoDisabled}
                    onPress={() => {
                      setPricingMode(m);
                      if (m === "Auto" && suggestion?.hasSuggestion) {
                        if (suggestion.suggestedMinPrice != null) setAutoMin(String(suggestion.suggestedMinPrice));
                        if (suggestion.suggestedMaxPrice != null) setAutoMax(String(suggestion.suggestedMaxPrice));
                      }
                    }}
                    style={[styles.modeCard, active && styles.modeCardActive, autoDisabled && styles.modeDisabled]}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <Check color={theme.onBrand} size={12} /> : null}
                    </View>
                    <Text style={[styles.modeText, active && styles.modeTextActive]}>
                      {m === "Fixed" ? "Tự nhập giá" : "Giá tự động"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {pricingMode === "Fixed" ? (
              <>
                <Text style={styles.fieldLabel}>Giá cho thuê (VNĐ/ngày) *</Text>
                <TextInput
                  value={fixedPrice}
                  onChangeText={setFixedPrice}
                  keyboardType="numeric"
                  placeholder="VD: 500000"
                  placeholderTextColor={theme.placeholder}
                  style={styles.input}
                />
              </>
            ) : (
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Giá tối thiểu *</Text>
                  <TextInput value={autoMin} onChangeText={setAutoMin} keyboardType="numeric" style={styles.input} />
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Giá tối đa *</Text>
                  <TextInput value={autoMax} onChangeText={setAutoMax} keyboardType="numeric" style={styles.input} />
                </View>
              </View>
            )}
            {areaId && !isPricingValid() ? (
              <Text style={styles.errorText}>Giá phải hợp lệ và nằm trong khung gợi ý (nếu có).</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Tiền cọc % (20-50)</Text>
            <TextInput value={depositPercent} onChangeText={setDepositPercent} keyboardType="numeric" style={styles.input} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Yêu cầu thế chấp</Text>
              <Switch value={requiresDeposit} onValueChange={setRequiresDeposit} trackColor={{ false: theme.faint, true: theme.brand }} />
            </View>
            {requiresDeposit ? (
              <>
                <Text style={styles.fieldLabel}>Số tiền thế chấp (VNĐ)</Text>
                <TextInput
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  keyboardType="numeric"
                  placeholder="VD: 2000000"
                  placeholderTextColor={theme.placeholder}
                  style={styles.input}
                />
              </>
            ) : null}
            <Text style={styles.fieldLabel}>Mô tả thêm</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholder="Mô tả về xe..."
              placeholderTextColor={theme.placeholder}
              style={[styles.input, styles.textArea]}
            />
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>Tính năng</Text>
            <Text style={styles.groupSub}>Chọn các tính năng xe của bạn có.</Text>
            <View style={styles.chips}>
              {features.map((f) => (
                <Pressable key={f.id} onPress={() => toggleFeature(f.id)} style={[styles.chip, featureIds.includes(f.id) && styles.chipActive]}>
                  {featureIds.includes(f.id) ? <Check color={theme.onBrand} size={12} /> : null}
                  <Text style={[styles.chipText, featureIds.includes(f.id) && styles.chipTextActive]}>{f.name}</Text>
                </Pressable>
              ))}
              {features.length === 0 ? <Text style={styles.muted}>Không có tính năng nào.</Text> : null}
            </View>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>Hình ảnh</Text>
            <Text style={styles.groupSub}>Chạm vào ảnh để đặt làm ảnh chính.</Text>
            <Pressable onPress={handlePickImages} disabled={uploadingImage} style={styles.pickBtn}>
              {uploadingImage ? <ActivityIndicator color={theme.brand} size="small" /> : <Plus color={theme.brand} size={16} />}
              <Text style={styles.pickText}>{uploadingImage ? "Đang tải..." : "Thêm hình ảnh"}</Text>
            </Pressable>
            <View style={styles.imageGrid}>
              {imageUrls.map((url, idx) => (
                <View key={url + idx} style={styles.imageCell}>
                  <Pressable onPress={() => setFeaturedIndex(idx)}>
                    <Image source={{ uri: url }} style={[styles.cellImage, idx === featuredIndex && styles.cellActive]} contentFit="cover" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setImageUrls((prev) => prev.filter((_, i) => i !== idx));
                      setFeaturedIndex(0);
                    }}
                    style={styles.removeBtn}
                  >
                    <X color="#FFF" size={12} />
                  </Pressable>
                  {idx === featuredIndex ? <Text style={styles.avatarLabel}>Ảnh chính</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 6 ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.groupTitle}>Xác nhận & cavet</Text>
            <Text style={styles.groupSub}>Kiểm tra lại trước khi hoàn tất.</Text>
            <View style={styles.summary}>
              <Text style={styles.summaryLine}>Biển số: {licensePlate || "-"}</Text>
              <Text style={styles.summaryLine}>Giá: {priceSummary}</Text>
              <Text style={styles.summaryLine}>
                {pricingMode === "Fixed" ? "Tự nhập giá" : "Giá tự động"} · Cọc {depositPercent}% · {imageUrls.length} ảnh · {featureIds.length} tiện ích
              </Text>
              <Text style={styles.summaryLine}>Địa chỉ: {address || "-"}</Text>
            </View>
            {!isEdit ? (
              <>
                <Text style={styles.fieldLabel}>Ảnh cavet (khuyên có để duyệt nhanh)</Text>
                <Pressable onPress={handlePickDoc} style={styles.pickBtn}>
                  <Plus color={theme.brand} size={16} />
                  <Text style={styles.pickText}>{docUri ? "Đã chọn cavet (chạm để đổi)" : "Chọn ảnh cavet"}</Text>
                </Pressable>
                {docUri ? <Image source={{ uri: docUri }} style={styles.docPreview} contentFit="contain" /> : null}
              </>
            ) : null}
            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {step > (isEdit ? 2 : 0) ? (
          <Pressable onPress={() => goStep(Math.max(isEdit ? 2 : 0, step - 1))} style={styles.backBtn}>
            <ChevronLeft color={theme.text} size={18} />
            <Text style={styles.backText}>Quay lại</Text>
          </Pressable>
        ) : (
          <View style={styles.flex} />
        )}
        {step < STEPS.length - 1 ? (
          <Pressable onPress={() => canProceed() && goStep(step + 1)} disabled={!canProceed()} style={[styles.nextBtn, !canProceed() && styles.disabledBtn]}>
            <Text style={styles.nextText}>Tiếp theo</Text>
            <ChevronRight color={theme.onBrand} size={16} />
          </Pressable>
        ) : (
          <Pressable onPress={handleSubmit} disabled={submitting || !canProceed()} style={[styles.nextBtn, (!canProceed() || submitting) && styles.disabledBtn]}>
            {submitting ? <ActivityIndicator color={theme.onBrand} size="small" /> : <Check color={theme.onBrand} size={16} />}
            <Text style={styles.nextText}>{submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Hoàn tất"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
    iconBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
    topTitle: { flex: 1, color: theme.text, fontSize: 17, fontWeight: "800" },
    stepCount: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    stepper: { paddingHorizontal: 16, paddingBottom: 10, position: "relative" },
    stepLine: { position: "absolute", left: 28, right: 28, top: 24, height: 2, backgroundColor: theme.border },
    stepDots: { flexDirection: "row", justifyContent: "space-between" },
    stepItem: { alignItems: "center", gap: 4, width: 48 },
    stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" },
    stepDotDone: { backgroundColor: theme.success, borderColor: theme.success },
    stepDotCurrent: { backgroundColor: theme.brand, borderColor: theme.brand },
    stepNum: { color: theme.muted, fontSize: 12, fontWeight: "800" },
    stepNumCurrent: { color: theme.onBrand },
    stepLabel: { color: theme.faint, fontSize: 9, fontWeight: "700", textAlign: "center" },
    stepLabelCurrent: { color: theme.brand },
    scroll: { padding: 16, gap: 12 },
    groupTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    groupSub: { color: theme.muted, fontSize: 13, marginTop: 2, marginBottom: 10 },
    lockedBox: { borderRadius: 12, backgroundColor: theme.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, padding: 12 },
    lockedText: { color: theme.muted, fontSize: 13, fontWeight: "600" },
    typeRow: { flexDirection: "row", gap: 12 },
    typeCard: { flex: 1, borderRadius: 16, borderWidth: 2, borderColor: theme.border, backgroundColor: theme.surface, padding: 20, alignItems: "center", gap: 8 },
    typeCardActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    typeCheck: { position: "absolute", right: 10, top: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: theme.brand, alignItems: "center", justifyContent: "center" },
    typeLabel: { color: theme.text, fontSize: 16, fontWeight: "800" },
    typeLabelActive: { color: theme.brand },
    typeHint: { color: theme.muted, fontSize: 11, textAlign: "center" },
    fieldGroup: { gap: 10 },
    fieldLabel: { color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
    input: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface, paddingHorizontal: 12, height: 46, color: theme.text, fontSize: 14 },
    textArea: { height: 84, paddingVertical: 10, textAlignVertical: "top" },
    twoCol: { flexDirection: "row", gap: 10 },
    col: { flex: 1, gap: 4 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 8 },
    chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    chipText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    chipTextActive: { color: theme.onBrand },
    suggestBox: { borderRadius: 12, backgroundColor: theme.infoSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.infoBorder, padding: 10, gap: 3 },
    suggestTitle: { color: theme.info, fontSize: 12, fontWeight: "800" },
    suggestText: { color: theme.info, fontSize: 12 },
    suggestHot: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    suggestFlags: { color: theme.muted, fontSize: 11, fontWeight: "600" },
    suggestEmpty: { borderRadius: 12, backgroundColor: "#FFFBEB", borderWidth: StyleSheet.hairlineWidth, borderColor: "#FDE68A", padding: 10 },
    suggestEmptyText: { color: "#92400E", fontSize: 12 },
    modeRow: { flexDirection: "row", gap: 10 },
    modeCard: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 2, borderColor: theme.border, paddingVertical: 12 },
    modeCardActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    modeDisabled: { opacity: 0.45 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.faint, alignItems: "center", justifyContent: "center" },
    radioActive: { borderColor: theme.brand, backgroundColor: theme.brand },
    modeText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    modeTextActive: { color: theme.brand },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    switchLabel: { color: theme.text, fontSize: 14, fontWeight: "700" },
    pickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: theme.brandBorder, paddingVertical: 14 },
    pickText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    imageCell: { width: "31%", gap: 4 },
    cellImage: { width: "100%", aspectRatio: 4 / 3, borderRadius: 10, borderWidth: 2, borderColor: "transparent" },
    cellActive: { borderColor: theme.brand },
    removeBtn: { position: "absolute", right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
    avatarLabel: { color: theme.brand, fontSize: 10, fontWeight: "800", textAlign: "center" },
    summary: { borderRadius: 14, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, padding: 12, gap: 6 },
    summaryLine: { color: theme.text, fontSize: 13, fontWeight: "600" },
    docPreview: { width: "100%", height: 180, borderRadius: 12, backgroundColor: theme.surfaceAlt },
    errorText: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 13 },
    bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, backgroundColor: theme.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingHorizontal: 16, paddingTop: 10 },
    backBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
    backText: { color: theme.text, fontSize: 14, fontWeight: "800" },
    nextBtn: { flex: 2, height: 48, borderRadius: 14, backgroundColor: theme.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    nextText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
    disabledBtn: { opacity: 0.5 },
    flex: { flex: 1 },
  });
