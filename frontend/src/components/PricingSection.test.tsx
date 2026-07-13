// @vitest-environment jsdom
import { afterEach,describe,expect,it } from 'vitest';import { cleanup,render,screen } from '@testing-library/react';import { PricingSection } from './PricingSection'
afterEach(cleanup)
describe('PricingSection',()=>{it('shows plan benefits without checkout forms',()=>{const {container}=render(<PricingSection/>);expect(screen.getByText((_,e)=>e?.textContent==='$149/month')).toBeTruthy();expect(screen.getByText('PR-triggered automated test runs')).toBeTruthy();expect(screen.getByText('Everything included in Starter')).toBeTruthy();expect(container.querySelector('form')).toBeNull();expect(screen.queryByRole('textbox')).toBeNull();expect(screen.queryByRole('button')).toBeNull()})})
