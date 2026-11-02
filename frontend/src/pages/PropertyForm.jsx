/**
 * PropertyForm.jsx  — Step 1
 * Collects property details. Field names match the backend Zod schema:
 *   propertyName, location, price, propertyType, features, contactText,
 *   agentName, agentPhone, agentEmail.
 */
import React, { useState } from 'react';
import FormField from '../components/FormField.jsx';
import StatusMessage from '../components/StatusMessage.jsx';

const EMPTY = {
  propertyName: '',
  location:     '',
  price:        '',
  propertyType: '',
  features:     '',   // user types comma-separated; split before submit
  description:  '',
  contactText:  '',
  agentName:    '',
  agentPhone:   '',
  agentEmail:   '',
};

const SAMPLE = {
  propertyName: 'Sunrise Residency',
  location:     'Mohali, Punjab',
  price:        '₹85 lakh',
  propertyType: '2-BHK Apartment',
  features:     'Two spacious bedrooms, Private balcony with city view, Covered parking, Modular kitchen',
  description:  'A beautifully designed 2-BHK apartment on the 7th floor with panoramic city views, modern fittings, and a ready-to-move status.',
  contactText:  'Contact us today to schedule a visit.',
  agentName:    'Priya Sharma',
  agentPhone:   '+91 98765 43210',
  agentEmail:   'priya@sunriseproperties.example.com',
};

export default function PropertyForm({ initial, onSubmit }) {
  const [fields, setFields] = useState(() =>
    initial
      ? { ...initial, features: (initial.features ?? []).join(', ') }
      : EMPTY
  );
  const [errors, setErrors] = useState({});

  function set(key, val) {
    setFields((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function loadSample() {
    setFields(SAMPLE);
    setErrors({});
  }

  function validate() {
    const e = {};
    if (!fields.propertyName.trim())  e.propertyName = 'Property name is required.';
    if (!fields.location.trim())      e.location     = 'Location is required.';
    if (!fields.price.trim())         e.price        = 'Price is required.';
    if (!fields.propertyType.trim())  e.propertyType = 'Property type is required.';
    const feats = fields.features.split(',').map((s) => s.trim()).filter(Boolean);
    if (feats.length === 0)           e.features     = 'Add at least one feature.';
    if (feats.length > 12)            e.features     = 'Maximum 12 features allowed.';
    if (fields.agentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.agentEmail))
      e.agentEmail = 'Enter a valid email address.';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const data = {
      ...fields,
      features: fields.features.split(',').map((s) => s.trim()).filter(Boolean),
    };
    onSubmit(data);
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 className="card-heading" style={{ margin: 0 }}>Property Details</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={loadSample}
          title="Fills the form with synthetic sample data">
          ✦ Load Sample Data
        </button>
      </div>

      {Object.keys(errors).length > 0 && (
        <StatusMessage type="error" title="Please fix the errors below." />
      )}

      <fieldset style={{ border: 'none', padding: 0, marginBottom: '1.25rem' }}>
        <legend style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Core Information
        </legend>
        <FormField label="Property Name" required error={errors.propertyName}>
          <input value={fields.propertyName} onChange={(e) => set('propertyName', e.target.value)}
            placeholder="e.g. Sunrise Residency" />
        </FormField>
        <FormField label="Location" required error={errors.location}>
          <input value={fields.location} onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. Mohali, Punjab" />
        </FormField>
        <div className="form-row">
          <FormField label="Asking Price" required error={errors.price}>
            <input value={fields.price} onChange={(e) => set('price', e.target.value)}
              placeholder="e.g. ₹85 lakh" />
          </FormField>
          <FormField label="Property Type" required error={errors.propertyType}>
            <input value={fields.propertyType} onChange={(e) => set('propertyType', e.target.value)}
              placeholder="e.g. 2-BHK Apartment" />
          </FormField>
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, marginBottom: '1.25rem' }}>
        <legend style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Description &amp; Features
        </legend>
        <FormField label="Key Features" required hint="Comma-separated — one caption per image scene" error={errors.features}>
          <input value={fields.features} onChange={(e) => set('features', e.target.value)}
            placeholder="Two bedrooms, Balcony, Covered parking" />
        </FormField>
        <FormField label="Description" hint="Optional overview shown in the voice-over script">
          <textarea rows={3} value={fields.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Brief overview of the property…" />
        </FormField>
        <FormField label="Contact / Enquiry Text" hint="Shown on the closing video scene">
          <input value={fields.contactText} onChange={(e) => set('contactText', e.target.value)}
            placeholder="Contact us today to schedule a visit." />
        </FormField>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Agent Contact <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
        </legend>
        <div className="form-row">
          <FormField label="Agent Name">
            <input value={fields.agentName} onChange={(e) => set('agentName', e.target.value)}
              placeholder="Priya Sharma" />
          </FormField>
          <FormField label="Agent Phone">
            <input value={fields.agentPhone} onChange={(e) => set('agentPhone', e.target.value)}
              placeholder="+91 98765 43210" />
          </FormField>
        </div>
        <FormField label="Agent Email" error={errors.agentEmail}>
          <input type="email" value={fields.agentEmail}
            onChange={(e) => set('agentEmail', e.target.value)}
            placeholder="agent@example.com" />
        </FormField>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg">
          Next: Upload Images →
        </button>
      </div>
    </form>
  );
}
