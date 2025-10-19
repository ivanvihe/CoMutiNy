import { Fragment } from 'react';
import { BUILD_CATEGORIES } from '../../buildings/catalog';
import type { BuildCategoryDefinition } from '../../buildings/catalog';
import type { BuildBlueprint, BuildCategory } from '../../buildings/types';
import './BuildMenu.css';

export interface BuildMenuProps {
  activeCategory: BuildCategory;
  onCategoryChange: (category: BuildCategory) => void;
  selectedBlueprint: BuildBlueprint | null;
  onSelectBlueprint: (blueprint: BuildBlueprint | null) => void;
}

const renderBlueprint = (
  blueprint: BuildBlueprint,
  selectedBlueprint: BuildBlueprint | null,
  onSelect: (blueprint: BuildBlueprint | null) => void,
) => {
  const isActive = selectedBlueprint?.id === blueprint.id;
  const handleClick = () => {
    onSelect(isActive ? null : blueprint);
  };

  return (
    <button
      key={blueprint.id}
      type="button"
      className={`build-menu__blueprint ${isActive ? 'is-active' : ''}`}
      onClick={handleClick}
      style={{
        borderColor: blueprint.previewColor,
        boxShadow: isActive ? `0 0 0 2px ${blueprint.previewColor}` : undefined,
      }}
    >
      <span
        className="build-menu__blueprint-icon"
        style={{ backgroundColor: blueprint.previewColor }}
        aria-hidden
      />
      <span className="build-menu__blueprint-content">
        <span className="build-menu__blueprint-name">{blueprint.name}</span>
        {blueprint.description ? (
          <span className="build-menu__blueprint-description">{blueprint.description}</span>
        ) : null}
      </span>
    </button>
  );
};

const renderCategory = (
  category: BuildCategoryDefinition,
  selectedBlueprint: BuildBlueprint | null,
  onSelectBlueprint: (blueprint: BuildBlueprint | null) => void,
) => (
  <Fragment key={category.id}>
    <div className="build-menu__category-header">
      <h3>{category.label}</h3>
      <p>{category.description}</p>
    </div>
    <div className="build-menu__blueprints">
      {category.blueprints.map((blueprint) =>
        renderBlueprint(blueprint, selectedBlueprint, onSelectBlueprint),
      )}
    </div>
  </Fragment>
);

export const BuildMenu = ({
  activeCategory,
  onCategoryChange,
  selectedBlueprint,
  onSelectBlueprint,
}: BuildMenuProps) => {
  const handleCategoryClick = (category: BuildCategory) => () => onCategoryChange(category);

  return (
    <aside className="build-menu">
      <header className="build-menu__header">
        <h2>Construcción</h2>
        <p>Selecciona una categoría y coloca estructuras dentro de tu parcela asignada.</p>
      </header>
      <nav className="build-menu__categories" aria-label="Categorías de construcción">
        {BUILD_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`build-menu__category ${activeCategory === category.id ? 'is-active' : ''}`}
            onClick={handleCategoryClick(category.id)}
          >
            {category.label}
          </button>
        ))}
      </nav>
      <section className="build-menu__content" aria-live="polite">
        {BUILD_CATEGORIES.filter((category) => category.id === activeCategory).map((category) =>
          renderCategory(category, selectedBlueprint, onSelectBlueprint),
        )}
      </section>
      <footer className="build-menu__footer">
        <button
          type="button"
          className="build-menu__clear"
          onClick={() => onSelectBlueprint(null)}
          disabled={!selectedBlueprint}
        >
          Cancelar construcción
        </button>
      </footer>
    </aside>
  );
};

export default BuildMenu;
