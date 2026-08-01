import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useRoute } from 'wouter';
import { fetchCategories } from '../../api/client';
import {
  createOwnProduct,
  fetchOwnProducts,
  reorderOwnProductImages,
  updateOwnProduct,
  type ManagedProduct,
} from '../../api/products';
import { ApiError } from '../../api/request';
import SellerPortalLayout from '../../components/seller/SellerPortalLayout';
import SellerRoute from '../../components/seller/SellerRoute';
import type { Category } from '../../types';

function EditorContent() {
  const [, params] = useRoute('/seller/products/:id/edit');
  const [, navigate] = useLocation();
  const editingId = params?.id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [existing, setExisting] = useState<ManagedProduct | null>(null);
  const [existingImages, setExistingImages] = useState<ManagedProduct['images']>([]);
  const [loading, setLoading] = useState(Boolean(editingId));
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('шт.');
  const [minimumQuantity, setMinimumQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const categoriesPromise = fetchCategories();
    const productPromise = editingId ? fetchOwnProducts() : Promise.resolve([]);
    Promise.all([categoriesPromise, productPromise])
      .then(([categoryItems, products]) => {
        setCategories(categoryItems);
        if (!editingId) {
          setCategoryId(String(categoryItems[0]?.id ?? ''));
          return;
        }
        const product = products.find((item) => item.id === editingId) ?? null;
        setExisting(product);
        if (product) {
          setExistingImages(product.images);
          setName(product.name);
          setDescription(product.description);
          setCategoryId(String(product.categoryId));
          setPrice((product.priceKopecks / 100).toFixed(2));
          setUnit(product.unit);
          setMinimumQuantity(String(product.minimumQuantity));
        }
      })
      .catch(() => setError('Не вдалося завантажити редактор товару.'))
      .finally(() => setLoading(false));
  }, [editingId]);

  useEffect(() => {
    const urls = files.map(URL.createObjectURL);
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const moveImage = (index: number, direction: -1 | 1) => {
    setFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const moveExistingImage = (index: number, direction: -1 | 1) => {
    setExistingImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input = {
      categoryId: Number(categoryId),
      name,
      description,
      priceKopecks: Math.round(Number(price.replace(',', '.')) * 100),
      unit,
      minimumQuantity: Number(minimumQuantity),
    };
    try {
      if (editingId) {
        await updateOwnProduct(editingId, input);
        await reorderOwnProductImages(editingId, existingImages.map((image) => image.id));
      } else await createOwnProduct(input, files);
      navigate('/seller/products');
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.code?.startsWith('IMAGE_')) {
        setError('Фото не пройшло перевірку. Використайте JPEG, PNG або WebP до 8 МБ.');
      } else {
        setError('Не вдалося зберегти товар. Перевірте всі поля.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="seller-route-state"><span className="loading loading-spinner" /> Завантажуємо редактор…</div>;
  if (editingId && !existing) return <div className="seller-route-state text-error">Товар не знайдено.</div>;

  return (
    <SellerPortalLayout>
      <main className="seller-workspace seller-workspace--wide">
        <form className="seller-product-editor" onSubmit={submit}>
          <section className="seller-product-editor__fields">
            <p className="seller-kicker">{editingId ? 'Редагування' : 'Новий товар'}</p>
            <h1>{editingId ? 'Оновіть картку товару' : 'Викладіть товар на прилавок'}</h1>
            <label className="seller-field"><span>Назва</span><input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="seller-field"><span>Категорія</span><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="seller-field"><span>Опис</span><textarea required minLength={3} maxLength={5000} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><label className="seller-field"><span>Ціна, ₴</span><input required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label className="seller-field"><span>Одиниця</span><input required maxLength={40} value={unit} onChange={(event) => setUnit(event.target.value)} /></label><label className="seller-field"><span>Мінімум</span><input required type="number" min="1" step="1" value={minimumQuantity} onChange={(event) => setMinimumQuantity(event.target.value)} /></label></div>
          </section>

          <aside className="seller-product-editor__images">
            <h2>Фотографії</h2>
            <p>{editingId ? 'Перетягування замінимо пізніше; порядок вже можна змінити стрілками.' : 'Від 1 до 5 фото. Перше стане обкладинкою.'}</p>
            {editingId ? <div className="seller-upload-grid">{existingImages.map((image, index) => <div key={image.id}><img src={image.thumbnailUrl} alt={image.altText} /><div><button type="button" disabled={index === 0} onClick={() => moveExistingImage(index, -1)}>←</button><span>{index === 0 ? 'Обкладинка' : index + 1}</span><button type="button" disabled={index === existingImages.length - 1} onClick={() => moveExistingImage(index, 1)}>→</button></div></div>)}</div> : <><label className="seller-upload-drop"><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} /><span>＋</span><strong>Обрати фотографії</strong><small>JPEG, PNG або WebP · до 8 МБ</small></label><div className="seller-upload-grid">{previews.map((preview, index) => <div key={preview}><img src={preview} alt={`Попередній перегляд ${index + 1}`} /><div><button type="button" disabled={index === 0} onClick={() => moveImage(index, -1)}>←</button><span>{index === 0 ? 'Обкладинка' : index + 1}</span><button type="button" disabled={index === previews.length - 1} onClick={() => moveImage(index, 1)}>→</button></div></div>)}</div></>}
            <div className="seller-variant-note"><strong>3 розміри автоматично</strong><span>thumbnail · medium · large</span><small>Орієнтація виправляється, metadata видаляється.</small></div>
            {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
            <button className="btn btn-primary w-full" disabled={saving || (!editingId && files.length === 0)}>{saving ? <span className="loading loading-spinner" /> : null}{editingId ? 'Зберегти зміни' : 'Опублікувати зараз'}</button>
          </aside>
        </form>
      </main>
    </SellerPortalLayout>
  );
}

export default function SellerProductEditorPage() {
  return <SellerRoute><EditorContent /></SellerRoute>;
}
