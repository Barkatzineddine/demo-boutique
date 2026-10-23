// Order board: one column per step, cards dragged to the next (or previous) step with dnd-kit.
// The same moves are buttons on each card and in the order dialog, for keyboard users.
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useDeferredValue, useState } from 'react';
import { can, ORDER_FLOW, type OrderStatus, type StaffAccount } from '../../domain/catalog';
import type { Order } from '../../domain/schema';
import { fold } from '../../domain/search';
import { useFormat } from '../../format';
import { canMove, moveOrder, refundOrder, useShop, type StaffError } from '../../state/app';
import { navigate } from '../../shared/router';
import { csv, download } from '../../shared/security';
import { Dialog } from '../../shared/ui/Dialog';
import { useFeedback } from '../../shared/ui/Feedback';
import { useNow } from '../../shared/useNow';
import { OrderDetail } from '../../ui/orders';

const SHOWN_DELIVERED = 12;

export default function Board({ staff, focus }: { staff: StaffAccount; focus: string | null }) {
  const { t, status, cents: price } = useFormat();
  const { toast } = useFeedback();
  const orders = useShop((s) => s.orders);
  const [q, setQ] = useState('');
  const query = fold(useDeferredValue(q).trim());
  const [dragging, setDragging] = useState<Order | null>(null);
  const [over, setOver] = useState<OrderStatus | null>(null);
  const open = focus ? orders.find((o) => o.id === focus) ?? null : null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );
  const visible = orders.filter((o) => !query || fold(`${o.number} ${o.customer.name} ${o.customer.city} ${o.customer.email}`).includes(query));
  const refunded = visible.filter((o) => o.status === 'refunded');

  const move = (o: Order, to: OrderStatus) => {
    const from = o.status;
    const error = moveOrder(o.id, to, staff);
    if (error) { toast(errorText(error), 'err'); return; }
    toast(t('board.moved', { number: o.number, status: status(to) }), 'ok', { label: t('board.undo'), run: () => { moveOrder(o.id, from, staff); } });
  };
  const errorText = (e: StaffError) => t(`board.err.${e}`);
  const onDragStart = (e: DragStartEvent) => setDragging(orders.find((o) => o.id === e.active.id) ?? null);
  const onDragOver = (e: DragOverEvent) => setOver((e.over?.id as OrderStatus | undefined) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const o = dragging;
    setDragging(null);
    setOver(null);
    const to = e.over?.id as OrderStatus | undefined;
    if (!o || !to || to === o.status) return;
    if (!canMove(o.status, to)) { toast(t('board.err.invalid'), 'err'); return; }
    move(o, to);
  };
  const exportCsv = () => {
    const rows = [[t('csv.number'), t('csv.date'), t('csv.status'), t('csv.client'), t('field.email'), t('field.zip'), t('field.city'), t('csv.shipping'), t('csv.items'), t('csv.total'), t('csv.vat')],
      ...visible.map((o) => [o.number, o.at.slice(0, 10), status(o.status), o.customer.name, o.customer.email, o.customer.zip, o.customer.city, t(`ship.${o.shipping}.name`),
        o.items.map((i) => `${i.qty} x ${i.name.fr}`).join(' | '), (o.totals.total / 100).toFixed(2).replace('.', ','), (o.totals.vat / 100).toFixed(2).replace('.', ',')])];
    download(`commandes-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows), 'text/csv;charset=utf-8');
    toast(t('board.exported', { n: visible.length }));
  };

  return (
    <section aria-label={t('admin.tab.board')}>
      <div className="board-tools">
        <div className="field">
          <label htmlFor="board-q">{t('board.search')}</label>
          <input id="board-q" type="search" maxLength={60} placeholder={t('board.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {can(staff.role, 'orders.export') ? <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>{t('board.export')}</button> : null}
      </div>
      <p className="hint">{t('board.hint')}</p>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setDragging(null); setOver(null); }}>
        <div className="board">
          {ORDER_FLOW.map((col) => {
            const list = visible.filter((o) => o.status === col);
            const shown = col === 'delivered' ? list.slice(0, SHOWN_DELIVERED) : list;
            const target = dragging && over === col && col !== dragging.status ? (canMove(dragging.status, col) ? 'ok' : 'bad') : '';
            return (
              <Column key={col} status={col} count={list.length} target={target}>
                {shown.map((o) => <Card key={o.id} order={o} staff={staff} ghost={dragging?.id === o.id} onMove={move} />)}
                {list.length > shown.length ? <li className="hint more">{t('board.more', { n: list.length - shown.length })}</li> : null}
                {!list.length ? <li className="hint empty-col">{t('board.emptyCol')}</li> : null}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>{dragging ? <div className="ocard ocard-overlay"><CardBody order={dragging} /></div> : null}</DragOverlay>
      </DndContext>
      {refunded.length ? (
        <details className="refunded">
          <summary>{t('board.refunded', { n: refunded.length })}</summary>
          <ul className="plain-list">
            {refunded.map((o) => <li key={o.id}><button type="button" className="linklike" onClick={() => navigate(`/admin?tab=board&o=${o.id}`)}>{o.number}</button> · {o.customer.name} · {price(o.totals.total)}</li>)}
          </ul>
        </details>
      ) : null}
      {open ? <OrderDialog order={open} staff={staff} onMove={move} onClose={() => navigate('/admin?tab=board', { replace: true })} /> : null}
    </section>
  );
}

function Column({ status: col, count, target, children }: { status: OrderStatus; count: number; target: string; children: React.ReactNode }) {
  const { status } = useFormat();
  const { setNodeRef } = useDroppable({ id: col });
  return (
    <section ref={setNodeRef} className={`col col-${col} ${target ? `is-${target}` : ''}`} aria-labelledby={`col-${col}`}>
      <h2 id={`col-${col}`} className="col-head"><span>{status(col)}</span><span className="col-count">{count}</span></h2>
      <ul className="col-list">{children}</ul>
    </section>
  );
}

function CardBody({ order }: { order: Order }) {
  const { t, cents: price } = useFormat();
  const now = useNow(60_000);
  const hours = Math.max(0, Math.round((now.getTime() - new Date(order.at).getTime()) / 36e5));
  const pieces = order.items.reduce((n, i) => n + i.qty, 0);
  return (
    <>
      <span className="oc-top"><strong>{order.number}</strong><span className="oc-age">{hours < 24 ? t('board.hoursAgo', { n: hours }) : t('board.daysAgo', { n: Math.round(hours / 24) })}</span></span>{' '}
      <span className="oc-name">{order.customer.name}</span>{' '}
      <span className="oc-meta">{t('board.pieces', { n: pieces })} · {price(order.totals.total)} · {t(`ship.${order.shipping}.short`)}</span>
    </>
  );
}

function Card({ order, staff, ghost, onMove }: { order: Order; staff: StaffAccount; ghost: boolean; onMove: (o: Order, to: OrderStatus) => void }) {
  const { t, status } = useFormat();
  const { attributes, listeners, setNodeRef } = useDraggable({ id: order.id, disabled: !can(staff.role, 'orders.move') });
  const i = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const prev = ORDER_FLOW[i - 1];
  const next = ORDER_FLOW[i + 1];
  return (
    <li className={`ocard st-${order.status} ${ghost ? 'is-ghost' : ''}`}>
      <button ref={setNodeRef} type="button" className="oc-open" onClick={() => navigate(`/admin?tab=board&o=${order.id}`)}
        {...listeners} {...attributes} role={undefined} aria-roledescription={undefined} aria-disabled={undefined}>
        <CardBody order={order} />
      </button>
      <span className="oc-moves">
        {prev ? <button type="button" className="oc-move" aria-label={t('board.back', { number: order.number, status: status(prev) })} onClick={() => onMove(order, prev)}>←</button> : null}
        {next ? <button type="button" className="oc-move" aria-label={t('board.next', { number: order.number, status: status(next) })} onClick={() => onMove(order, next)}>→</button> : null}
      </span>
    </li>
  );
}

function OrderDialog({ order, staff, onMove, onClose }: { order: Order; staff: StaffAccount; onMove: (o: Order, to: OrderStatus) => void; onClose: () => void }) {
  const { t, status, cents: price, dateTime } = useFormat();
  const { confirm, toast } = useFeedback();
  const i = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const next = i >= 0 ? ORDER_FLOW[i + 1] : undefined;
  const refund = async () => {
    if (!(await confirm({ title: t('board.refundTitle', { number: order.number }), body: t('board.refundBody', { amount: price(order.totals.total) }), ok: t('board.refund'), cancel: t('common.cancel'), danger: true }))) return;
    const error = refundOrder(order.id, staff);
    toast(error ? t(`board.err.${error}`) : t('board.refunded1', { number: order.number }), error ? 'err' : 'ok');
  };
  const c = order.customer;
  return (
    <Dialog open onClose={onClose} title={`${order.number} · ${status(order.status)}`} wide>
      <p className="hint">{dateTime(order.at)} · {t(`pay.${order.method}`)}</p>
      <p><strong>{c.name}</strong> · <a href={`mailto:${c.email}`}>{c.email}</a> · <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a></p>
      <OrderDetail order={order} />
      <h3 className="sub-title">{t('board.history')}</h3>
      <ol className="history">
        {order.history.map((h, k) => <li key={k}>{status(h.status)} · {dateTime(h.at)} · {h.by === 'customer' ? t('board.byCustomer') : h.by}</li>)}
      </ol>
      <div className="dialog-actions">
        {next && can(staff.role, 'orders.move') ? <button type="button" className="btn btn-primary btn-sm" onClick={() => onMove(order, next)}>{t('board.markAs', { status: status(next) })}</button> : null}
        {can(staff.role, 'orders.refund') && order.status !== 'refunded' && order.status !== 'delivered'
          ? <button type="button" className="btn btn-danger btn-sm" onClick={() => void refund()}>{t('board.refund')}</button> : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.close')}</button>
      </div>
    </Dialog>
  );
}
