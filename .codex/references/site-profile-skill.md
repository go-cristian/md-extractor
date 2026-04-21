# Site Profile Skill Contract

Este documento define el contrato esperado para un skill offline que ayude a crear perfiles de extracción por sitio a partir de HTML guardado.

## Objetivo

Tomar uno o varios fixtures HTML reales de un sitio y proponer un perfil serializable que luego pueda vivir en `src/shared/extractionProfiles.ts`.

El skill no corre dentro de la extensión. La extensión solo consume perfiles ya versionados y testeados.

## Input esperado

- URL real o URL de referencia del sitio
- HTML guardado del producto (`tests/fixtures/...`)
- opcionalmente HTML antes y después de expandir contenido
- opcionalmente notas humanas sobre qué contenido sí importa y qué ruido debe ignorarse

Ejemplo real local para Amazon:

- `amazon-1.html`: DOM antes de abrir contenido adicional
- `amazon-2.html`: DOM después de abrir/resumir contenido
- `amazon.md`: aproximación humana del Markdown útil esperado

## Output esperado

El skill debe producir una propuesta con estas partes:

1. `match`
- hostnames probables
- señales DOM confiables (`signals`)

2. `reveal`
- pasos seguros e idempotentes
- solo expansiones de contenido relevantes
- nunca acciones de compra, cupones, login, variantes o checkout

3. `blocks`
- bloques serializables en orden esperado
- tipos permitidos: `heading`, `paragraph`, `list`, `table`, `image`
- cada bloque debe proponer `selectors` en fallback order

4. `noise review`
- nodos o zonas que el perfil decidió ignorar
- explicación breve del porqué

5. `test notes`
- qué assertions deberían agregarse a fixtures unitarios o e2e

## Forma del perfil

```ts
interface SiteExtractionProfile {
  id: string;
  hostnames?: string[];
  signals?: string[];
  reveal?: RevealStep[];
  blocks: ExtractionBlockConfig[];
}
```

## Reglas del skill

- priorizar selectores pequeños y robustos sobre rutas DOM largas
- usar varios selectores por bloque cuando el sitio tenga variantes de layout
- proponer `signals` que también sirvan en fixtures locales con hostname no real
- antes de proponer `reveal`, buscar contenido útil ya pre-renderizado pero oculto en el DOM, por ejemplo `a-popover-preload`, overlays preload, quick views, tabs ya hidratados o summaries embebidos
- si existe una fuente pre-renderizada más limpia que la página visible, preferir esa fuente en `blocks` y dejar `reveal` solo como fallback seguro
- si el contenido importante está oculto y no existe versión pre-renderizada usable, proponer `reveal` antes de `blocks`
- si el HTML no alcanza para inferir un reveal correcto, marcarlo como `needs_manual_validation`
- no proponer nada que cambie estado comercial del usuario

## Flujo recomendado

1. guardar fixture HTML real
2. correr el skill sobre ese fixture
3. revisar propuesta de perfil
4. convertir la propuesta a `src/shared/extractionProfiles.ts`
5. agregar tests unitarios
6. agregar o actualizar e2e
7. validar con `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`

## Criterio de aceptación

Un perfil está listo cuando:

- mejora claramente el resultado frente al fallback genérico
- revela contenido útil de forma segura
- evita ruido frecuente del sitio
- queda cubierto por fixtures y pruebas
