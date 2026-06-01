import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ConfirmDialog from '@/components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="T" message="M" confirmLabel="OK" onConfirm={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title and message when open', () => {
    render(
      <ConfirmDialog open={true} title="Confirmar" message="Tem certeza?" confirmLabel="Sim" onConfirm={vi.fn()} />
    )
    expect(screen.getByText('Confirmar')).toBeInTheDocument()
    expect(screen.getByText('Tem certeza?')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog open={true} title="T" message="M" confirmLabel="Excluir" onConfirm={onConfirm} />
    )
    fireEvent.click(screen.getByText('Excluir'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows cancel button when onCancel is provided', () => {
    render(
      <ConfirmDialog open={true} title="T" message="M" confirmLabel="OK" onConfirm={vi.fn()} onCancel={vi.fn()} />
    )
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog open={true} title="T" message="M" confirmLabel="OK" onConfirm={vi.fn()} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('stops propagation when inner dialog is clicked', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <ConfirmDialog open={true} title="T" message="M" confirmLabel="OK" onConfirm={vi.fn()} onCancel={onCancel} />
    )
    const innerDialog = container.querySelector('.bg-card')!
    fireEvent.click(innerDialog)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onConfirm when backdrop is clicked (no onCancel)', () => {
    const onConfirm = vi.fn()
    const { container } = render(
      <ConfirmDialog open={true} title="T" message="M" confirmLabel="OK" onConfirm={onConfirm} />
    )
    const backdrop = container.querySelector('.fixed.inset-0')!
    fireEvent.click(backdrop)
    expect(onConfirm).toHaveBeenCalled()
  })
})
