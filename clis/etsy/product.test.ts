import { describe, expect, it } from 'vitest';
import { getRegistry } from '@jackwener/opencli/registry';
import './product.js';
import './search.js';
import './images.js';

describe('etsy product', () => {
  const command = getRegistry().get('etsy/product');

  it('is registered', () => {
    expect(command).toBeDefined();
  });

  it('has correct metadata', () => {
    expect(command!.site).toBe('etsy');
    expect(command!.name).toBe('product');
    expect(command!.strategy).toBe('cookie');
    expect(command!.domain).toBe('www.etsy.com');
  });

  it('has expected args', () => {
    const args = command!.args!;
    expect(args).toHaveLength(1);
    expect(args[0].name).toBe('pid');
    expect(args[0].required).toBe(true);
  });

  it('has expected columns', () => {
    const cols = command!.columns;
    expect(cols).toContain('pid');
    expect(cols).toContain('title');
    expect(cols).toContain('price');
    expect(cols).toContain('shop');
    expect(cols).toContain('signals');
    expect(cols).toContain('imgs_count');
    expect(cols).toContain('reviews_count');
  });
});

describe('etsy search', () => {
  const command = getRegistry().get('etsy/search');

  it('is registered', () => {
    expect(command).toBeDefined();
  });

  it('has correct metadata', () => {
    expect(command!.site).toBe('etsy');
    expect(command!.name).toBe('search');
    expect(command!.strategy).toBe('cookie');
  });

  it('has expected args', () => {
    const argNames = command!.args!.map((a: { name: string }) => a.name);
    expect(argNames).toContain('query');
    expect(argNames).toContain('limit');
    expect(argNames).toContain('scroll');
  });

  it('has required query arg', () => {
    const query = command!.args!.find((a: { name: string }) => a.name === 'query');
    expect(query?.required).toBe(true);
  });
});

describe('etsy images', () => {
  const command = getRegistry().get('etsy/images');

  it('is registered', () => {
    expect(command).toBeDefined();
  });

  it('has correct metadata', () => {
    expect(command!.site).toBe('etsy');
    expect(command!.name).toBe('images');
    expect(command!.strategy).toBe('cookie');
  });

  it('has expected args', () => {
    const argNames = command!.args!.map((a: { name: string }) => a.name);
    expect(argNames).toContain('pid');
    expect(argNames).toContain('outdir');
    expect(argNames).toContain('max');
    expect(argNames).toContain('size');
  });

  it('has required pid arg', () => {
    const pid = command!.args!.find((a: { name: string }) => a.name === 'pid');
    expect(pid?.required).toBe(true);
  });
});
