/**
 * PAPER MAX - Categories Module
 * Handles category creation, update, listing, safe deletion, and product counting.
 */

import { loadCategories, saveCategories, loadProducts } from '../../data/storage.js';
import { bus } from '../../core/events.js';
import { generateId } from '../../utils/sanitize.js';

export function getCategories() {
  return loadCategories();
}

export function getCategoryById(id) {
  return getCategories().find(c => c.id === id) || null;
}

export function getProductCountForCategory(categoryId) {
  const products = loadProducts();
  return products.filter(p => p.categoryId === categoryId).length;
}

export function createCategory({ name, description = '' }) {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    throw new Error('Informe o Nome da categoria.');
  }

  const categories = getCategories();
  const exists = categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    throw new Error('Já existe uma categoria com este nome.');
  }

  const newCategory = {
    id: generateId('cat'),
    name: cleanName,
    description: (description || '').trim(),
    createdAt: new Date().toISOString()
  };

  categories.push(newCategory);
  saveCategories(categories, true);
  bus.emit('categories:changed', categories);
  return newCategory;
}

export function updateCategory(id, { name, description }) {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    throw new Error('Informe o Nome da categoria.');
  }

  const categories = getCategories();
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) {
    throw new Error('Categoria não encontrada.');
  }

  const duplicate = categories.some(c => c.id !== id && c.name.toLowerCase() === cleanName.toLowerCase());
  if (duplicate) {
    throw new Error('Já existe outra categoria com este nome.');
  }

  categories[index] = {
    ...categories[index],
    name: cleanName,
    description: (description || '').trim(),
    updatedAt: new Date().toISOString()
  };

  saveCategories(categories, true);
  bus.emit('categories:changed', categories);
  return categories[index];
}

export function deleteCategory(id) {
  const products = loadProducts();
  const linkedCount = products.filter(p => p.categoryId === id).length;

  if (linkedCount > 0) {
    return {
      success: false,
      message: `Não é possível excluir: existem ${linkedCount} produto(s) vinculado(s) a esta categoria. Mova ou reclassifique os produtos antes de excluir.`
    };
  }

  let categories = getCategories();
  const beforeCount = categories.length;
  categories = categories.filter(c => c.id !== id);

  if (categories.length === beforeCount) {
    return { success: false, message: 'Categoria não encontrada.' };
  }

  saveCategories(categories, true);
  bus.emit('categories:changed', categories);
  return { success: true, message: 'Categoria excluída com sucesso.' };
}

export function getSubcategories(categoryId) {
  const cat = getCategoryById(categoryId);
  return (cat && Array.isArray(cat.subcategories)) ? cat.subcategories : [];
}

export function createSubcategory(categoryId, name) {
  const cleanName = (name || '').trim();
  if (!cleanName) throw new Error('Informe o nome da sub-categoria.');
  const categories = getCategories();
  const index = categories.findIndex(c => c.id === categoryId);
  if (index === -1) throw new Error('Selecione uma categoria principal primeiro.');
  
  categories[index].subcategories = categories[index].subcategories || [];
  if (!categories[index].subcategories.includes(cleanName)) {
    categories[index].subcategories.push(cleanName);
    saveCategories(categories, true);
    bus.emit('categories:changed', categories);
  }
  return cleanName;
}
