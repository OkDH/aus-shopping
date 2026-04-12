"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/db";

interface ProductType {
  id: string;
  name: string;
}

interface Product {
  id: string;
  productTypeId: string;
  name: string;
  defaultUnit: string;
  productType?: ProductType;
}

interface Price {
  id: string;
  productId: string;
  market: string;
  price: number;
  volume: number;
}

interface ProductWithPrices extends Product {
  prices: Price[];
  productType?: ProductType;
}

const MARKETS = ["Woolworths", "Coles", "Aldi", "IGA", "하나로마트", "K-Fresh 마트"];

const DEFAULT_PRODUCT_TYPES = [
  "우유", "과일", "채소", "육류", "해산물", "빵", "음료", "간식", "기타"
];

type FormMode = "add" | "edit" | "price";

export default function Home() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [products, setProducts] = useState<ProductWithPrices[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [editingProduct, setEditingProduct] = useState<ProductWithPrices | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    productType: "",
    productTypeId: "",
    name: "",
    defaultUnit: "ml",
    market: "Woolworths",
    price: "",
    volume: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [typesRes, productsRes] = await Promise.all([
      supabase.from("ProductType").select("*"),
      supabase.from("Product").select(`
        *,
        productType:ProductType(*),
        prices:Price(*)
      `),
    ]);

    if (typesRes.data) setProductTypes(typesRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    setLoading(false);
  };

  const allProductTypes = useMemo(() => {
    const existingNames = productTypes.map((pt) => pt.name);
    const combined = [...new Set([...DEFAULT_PRODUCT_TYPES, ...existingNames])];
    return combined.sort();
  }, [productTypes]);

  const filteredProductTypes = useMemo(() => {
    if (!formData.productType) return [];
    const query = formData.productType.toLowerCase();
    return allProductTypes.filter((pt) => pt.toLowerCase().includes(query));
  }, [formData.productType, allProductTypes]);

  const resetForm = () => {
    setFormData({
      productType: "",
      productTypeId: "",
      name: "",
      defaultUnit: "ml",
      market: "Woolworths",
      price: "",
      volume: "",
    });
    setEditingProduct(null);
    setFormMode("add");
  };

  const openEditForm = (product: ProductWithPrices) => {
    setEditingProduct(product);
    setFormData({
      productType: product.productType?.name || "",
      productTypeId: product.productTypeId,
      name: product.name,
      defaultUnit: product.defaultUnit,
      market: "Woolworths",
      price: "",
      volume: "",
    });
    setFormMode("edit");
    setShowForm(true);
  };

  const openAddPriceForm = (product: ProductWithPrices) => {
    setEditingProduct(product);
    setFormData({
      productType: product.productType?.name || "",
      productTypeId: product.productTypeId,
      name: product.name,
      defaultUnit: product.defaultUnit,
      market: "Woolworths",
      price: "",
      volume: "",
    });
    setFormMode("price");
    setShowForm(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("Product")
      .delete()
      .eq("id", productId);

    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      fetchData();
    }
  };

  const handleDeletePrice = async (priceId: string) => {
    if (!confirm("이 가격을 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("Price")
      .delete()
      .eq("id", priceId);

    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      fetchData();
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    let typeId = formData.productTypeId;

    if (!typeId && formData.productType) {
      const { data: newType, error: typeError } = await supabase
        .from("ProductType")
        .insert({ name: formData.productType })
        .select()
        .single();
      if (typeError) {
        alert("제품 유형 생성 실패: " + typeError.message);
        return;
      }
      if (newType) typeId = newType.id;
    }

    if (!typeId) {
      alert("제품 유형을 선택하거나 새로 입력해주세요.");
      return;
    }

    const { error: productError } = await supabase
      .from("Product")
      .insert({
        productTypeId: typeId,
        name: formData.name,
        defaultUnit: formData.defaultUnit,
      });

    if (productError) {
      alert("제품 생성 실패: " + productError.message);
      return;
    }

    resetForm();
    setShowForm(false);
    fetchData();
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct) return;

    let typeId = formData.productTypeId;

    if (!typeId && formData.productType) {
      const { data: newType, error: typeError } = await supabase
        .from("ProductType")
        .insert({ name: formData.productType })
        .select()
        .single();
      if (typeError) {
        alert("제품 유형 생성 실패: " + typeError.message);
        return;
      }
      if (newType) typeId = newType.id;
    }

    if (!typeId) {
      alert("제품 유형을 선택하거나 새로 입력해주세요.");
      return;
    }

    const { error: updateError } = await supabase
      .from("Product")
      .update({
        productTypeId: typeId,
        name: formData.name,
        defaultUnit: formData.defaultUnit,
      })
      .eq("id", editingProduct.id);

    if (updateError) {
      alert("제품 수정 실패: " + updateError.message);
      return;
    }

    resetForm();
    setShowForm(false);
    fetchData();
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct) return;

    const { error: priceError } = await supabase.from("Price").insert({
      productId: editingProduct.id,
      market: formData.market,
      price: parseFloat(formData.price),
      volume: parseInt(formData.volume),
    });

    if (priceError) {
      alert("가격 추가 실패: " + priceError.message);
      return;
    }

    resetForm();
    setShowForm(false);
    fetchData();
  };

  const getPricePerUnit = (price: number, volume: number, unit: string): number => {
    if (volume === 0) return 0;
    if (unit === "개") return price / volume;
    if (unit === "L") return price / volume;
    if (unit === "kg") return price / (volume / 1000);
    return price / (volume / 100);
  };

  const getPricePerUnitLabel = (unit: string): string => {
    if (unit === "개") return "1개당";
    if (unit === "L") return "1L당";
    if (unit === "kg") return "1kg당";
    return `100${unit}당`;
  };

  const getBestPrice = (product: ProductWithPrices): Price | null => {
    if (product.prices.length === 0) return null;
    return product.prices.reduce((best, current) => {
      const currentPerUnit = getPricePerUnit(current.price, current.volume, product.defaultUnit);
      const bestPerUnit = getPricePerUnit(best.price, best.volume, product.defaultUnit);
      return currentPerUnit < bestPerUnit ? current : best;
    });
  };

  const filteredProducts = searchQuery
    ? products.filter((p) => {
        const query = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.productType?.name.toLowerCase().includes(query)
        );
      })
    : products;

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const bestA = getBestPrice(a);
    const bestB = getBestPrice(b);
    if (!bestA || !bestB) return 0;
    const perUnitA = getPricePerUnit(bestA.price, bestA.volume, a.defaultUnit);
    const perUnitB = getPricePerUnit(bestB.price, bestB.volume, b.defaultUnit);
    return perUnitA - perUnitB;
  });

  const handleProductTypeSelect = (name: string) => {
    const existing = productTypes.find((pt) => pt.name === name);
    setFormData({
      ...formData,
      productType: name,
      productTypeId: existing?.id || "",
    });
  };

  const getFormTitle = () => {
    if (formMode === "edit") return "제품 수정";
    if (formMode === "price") return `가격 추가: ${formData.name}`;
    return "제품/가격 추가";
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-md"
          placeholder="제품명 또는 제품 검색 (예: 우유, 서울)"
        />
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? "취소" : "+ 제품 추가"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{getFormTitle()}</h2>
          <form
            onSubmit={formMode === "edit" ? handleUpdateProduct : formMode === "price" ? handleAddPrice : handleAddProduct}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">제품</label>
                <input
                  type="text"
                  value={formData.productType}
                  onChange={(e) => handleProductTypeSelect(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="예: 우유"
                  list="product-types-list"
                  autoComplete="off"
                  required={formMode !== "price"}
                  disabled={formMode === "price"}
                />
                <datalist id="product-types-list">
                  {filteredProductTypes.map((pt) => (
                    <option key={pt} value={pt} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제품명</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="예: 서울 우유"
                  required={formMode !== "price"}
                  disabled={formMode === "price"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">단위</label>
                <select
                  value={formData.defaultUnit}
                  onChange={(e) => setFormData({ ...formData, defaultUnit: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={formMode === "price"}
                >
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="개">개</option>
                </select>
              </div>
              {formMode === "price" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">마켓</label>
                    <select
                      value={formData.market}
                      onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      {MARKETS.map((market) => (
                        <option key={market} value={market}>{market}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">가격 ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="예: 3.50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">용량</label>
                    <input
                      type="number"
                      value={formData.volume}
                      onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="예: 1000 (ml)"
                      required
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {formMode === "edit" ? "수정" : formMode === "price" ? "가격 추가" : "추가"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="py-2 px-4 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          {searchQuery ? `검색 결과: ${sortedProducts.length}개` : `전체 제품: ${sortedProducts.length}개`}
        </h2>
        {sortedProducts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {searchQuery ? "검색 결과가 없습니다." : "아직 등록된 제품이 없습니다."}
          </p>
        ) : (
          <ul className="space-y-3">
            {sortedProducts.map((product) => {
              const best = getBestPrice(product);
              return (
                <li key={product.id} className="p-4 border rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">
                        {product.productType?.name} - {product.name}
                      </h3>
                      <p className="text-sm text-gray-500">{product.defaultUnit}</p>
                    </div>
                    {best && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">{best.market}</p>
                        <p className="text-lg font-bold">${best.price.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{getPricePerUnitLabel(product.defaultUnit)} ${getPricePerUnit(best.price, best.volume, product.defaultUnit).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.prices.map((price) => (
                      <span key={price.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                        {price.market}: ${price.price.toFixed(2)} ({price.volume}{product.defaultUnit})
                        <button
                          onClick={() => handleDeletePrice(price.id)}
                          className="ml-1 text-red-500 hover:text-red-700 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openAddPriceForm(product)}
                      className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                    >
                      + 가격 추가
                    </button>
                    <button
                      onClick={() => openEditForm(product)}
                      className="text-sm px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
