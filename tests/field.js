import Field from '../src/field';

test('constructs a headless field with default values', () => {
  const field = new Field(null);

  expect(field.id).toBeTruthy(); // has been id'ed.
  expect(field.scope).toBe(null);
  expect(field.name).toBe(null);
  expect(field.classes).toBe(false);
  expect(field.rules).toEqual({});
  expect(field.events).toEqual(['input', 'blur']);
  expect(field.watchers.length).toBe(0);
  expect(field.delay).toBe(0);
  expect(field.flags).toEqual({
    untouched: true,
    touched: false,
    dirty: false,
    pristine: true,
    valid: null,
    invalid: null,
    validated: false,
    pending: false,
    required: false
  });
  expect(field.classNames).toEqual({
    touched: 'touched',
    untouched: 'untouched',
    valid: 'valid',
    invalid: 'invalid',
    pristine: 'pristine',
    dirty: 'dirty'
  });
  expect(field.isHeadless).toBe(true);
});

test('fields can be configured to not add any value listener', () => {
  document.body.innerHTML = `
    <input name="name" id="name">
  `;
  const el = document.querySelector('#name');
  const field = new Field(el, { listen: false });
  expect(field.watchers.length).toBe(2); // just action listeners.
});

test('caches the field id on the element data attributes', () => {
  document.body.innerHTML = `
    <input name="name" id="name">
  `;
  const el = document.querySelector('#name');
  const field = new Field(el);

  // check if id was cached.
  expect(el.getAttribute('data-vv-id')).toBe(field.id);
  expect(field.isHeadless).toBe(false);
});

test('it adds value listeners on the native inputs', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="10">
  `;
  const el = document.querySelector('#name');
  const field = new Field(el, { getter: () => el.value });

  // two events [input and blur] along with same events for actions.
  expect(field.watchers.length).toBe(4);
  field.addValueListeners(); // Idempotence call.
  expect(field.watchers.length).toBe(4); // still 4

  field.vm = { $validator: { validate: jest.fn() } };
  
  // test input event.
  el.dispatchEvent(new Event('input'));
  expect(field.validator.validate).toHaveBeenCalledWith(`#${field.id}`, field.value);

  // blur event.
  el.dispatchEvent(new Event('blur'));
  expect(field.validator.validate).toHaveBeenCalledTimes(2);
  expect(field.validator.validate).toHaveBeenLastCalledWith(`#${field.id}`, field.value);

  // test event removal
  field.unwatch(/input/);
  // none are left.
  expect(field.watchers.length).toBe(0);
  el.dispatchEvent(new Event('blur'));

  // has not changed since it was removed.
  expect(field.validator.validate).toHaveBeenCalledTimes(2);
});

test('it adds value listeners on all radio inputs that have the same name', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="1" type="radio">
    <input name="name" value="2" type="radio">
    <input name="name" id="last" value="3" type="radio">
  `;
  const el = document.querySelector('#name');
  const el2 = document.querySelector('#last');
  const field = new Field(el, { getter: () => el.value });
  field.vm = { $validator: { validate: jest.fn() } };
  el2.dispatchEvent(new Event('change'));

  expect(field.validator.validate).toHaveBeenCalledTimes(1); // triggered.
  expect(field.watchers.length).toBe(8); // 4 for each field.
  field.unwatch();
  el2.dispatchEvent(new Event('change'));
  expect(field.watchers.length).toBe(0);
  expect(field.validator.validate).toHaveBeenCalledTimes(1);
});

test('it adds value listeners on the components', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="10">
  `;
  const el = document.querySelector('#name');
  const field = new Field(el, {
    component: { $on: jest.fn(), $off: jest.fn() },
    getters: {
      context: () => el,
      value: (ctx) => ctx.value
    }
  });

  // two events [input and blur] with the classes.
  expect(field.watchers.length).toBe(4);
  expect(field.component.$on).toHaveBeenCalledTimes(2);
  field.addValueListeners(); // Idempotence call.
  expect(field.watchers.length).toBe(4); // still 4
});


test('computes the disabled property', () => {
  document.body.innerHTML = `<input name="name" id="name" value="10">`;
  const el = document.querySelector('#name');
  const field = new Field(el);

  expect(field.isDisabled).toBe(false);
  el.disabled = true;
  expect(field.isDisabled).toBe(true);

  field.component = { disabled: true };
  expect(field.isDisabled).toBe(true);
});

test('computes the display name', () => {
  const field = new Field(null, { name: 'email' });
  // no alias was defined.
  expect(field.displayName).toBe(undefined);
  field.alias = 'aliased';
  expect(field.displayName).toBe('aliased');
});

test('it exposes a boolean to check wether it is a component or not', () => {
  let field = new Field(null, { component: null });
  expect(field.isVue).toBe(false);
  field = new Field(null, { component: {} });
  expect(field.isVue).toBe(true);
});

test('it adds class listeners on the input', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="10" type="text">
  `;
  const el = document.querySelector('#name');
  const field = new Field(el, { classes: true });

  // input, blur, focus, and another input.
  expect(field.watchers.length).toBe(4);
  field.addActionListeners(); // Idempotence call.
  expect(field.watchers.length).toBe(4); // still 4

  field.updateClasses();
  expect(el.classList.contains('untouched')).toBe(true);
  expect(el.classList.contains('pristine')).toBe(true);


  // test classes and one shot behavior.
  el.dispatchEvent(new Event('input'));
  expect(field.watchers.length).toBe(3); // 1 event down.
  expect(el.classList.contains('dirty')).toBe(true);
  expect(field.flags.dirty).toBe(true);
  expect(el.classList.contains('pristine')).toBe(false);
  expect(field.flags.pristine).toBe(false);
  
  el.dispatchEvent(new Event('blur'));
  expect(field.watchers.length).toBe(2); // 1 more down.
  expect(el.classList.contains('untouched')).toBe(false);
  expect(field.flags.untouched).toBe(false);
  expect(el.classList.contains('touched')).toBe(true);
  expect(field.flags.touched).toBe(true);

  // disable the classes after being enabled.
  field.addActionListeners(); // Idempotence call.
  expect(field.watchers.length).toBe(4); // back to 4.
  field.update({ classes: false }); // disable classes.
  expect(field.watchers.length).toBe(2); // they got cleaned up.
});

test('it adds class listeners on components', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="10" type="text">
  `;
  const component = {
    evts: [],
    $once: jest.fn((evt, cb) => {
      component.evts.push({ evt, cb });
    }),
    $off: jest.fn((evt) => {
      component.evts = component.evts.filter(e => e.evt !== evt);
    }),
    $on: jest.fn(),
    $emit: jest.fn(event => {
      component.evts.forEach(e => e.cb());
    })
  };
  const el = document.querySelector('#name');
  const field = new Field(el, {
    events: '',
    classes: true,
    component,
  });

  expect(field.component.$once).toHaveBeenCalledTimes(2);
  component.$emit('input');
  // first call was to off the input listener.
  expect(field.component.$off.mock.calls[0][0]).toBe('input');

  component.$emit('blur');
  // second call was to off the blur listener.
  expect(field.component.$off.mock.calls[1][0]).toBe('blur');
  expect(field.component.$off).toHaveBeenCalledTimes(2);

  // only once.
  component.$emit('input');
  component.$emit('blur');
  expect(field.component.$off).toHaveBeenCalledTimes(2);

  // no events.
  expect(field.watchers.length).toBe(0);
});

test('it checks against a specified matcher', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="10" type="text">
  `;
  const el = document.querySelector('#name');
  const field = new Field(el, { name: 'name' });
  // match by name.
  expect(field.matches({
    name: 'name'
  })).toBe(true);

  // match by scope.
   expect(field.matches({
    scope: null
  })).toBe(true);

  // both
  expect(field.matches({
    scope: null,
    name: 'email'
  })).toBe(false);

  expect(field.matches({
    scope: null,
    name: 'name'
  })).toBe(true);

  // match by id.
  expect(field.matches({
    id: field.id
  })).toBe(true);

  // no matcher.
  expect(field.matches({})).toBe(true);

  // field is disabled, no matches.
  el.disabled = true;
  expect(field.matches({
    id: field.id
  })).toBe(false);
});

test('uses the watch API instead of adding listeners if the field is bound with a model', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="10" type="text">
  `;
  const el = document.querySelector('#name');
  // opt in for only the input event.
  const field = new Field(el, { model: 'email', events: 'input', vm: { $watch: jest.fn() } });

  // one for model, two for user actions.
  expect(field.watchers.length).toBe(3);
  expect(field.watchers[2].tag).toBe('input_model');
  expect(field.vm.$watch).toHaveBeenCalled();
});

test('fields can be destroyed and have all their listeners cleaned up along with their dependencies', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="10" type="text">
  `;
  const el = document.querySelector('#name');
  const field = new Field(el, { name: 'name', classes: true });
  const destroy = jest.fn();
  field.dependencies.push({ field: { destroy }});
  expect(field.watchers.length).toBe(4);
  field.destroy();
  expect(field.watchers.length).toBe(0);
  expect(destroy).toHaveBeenCalled();
})

test('sets aria attributes on elements', async () => {
  let el = document.createElement('input');
  const field = new Field(el, { rules: 'required' });
  expect(el.getAttribute('aria-required')).toBe('true');
  expect(el.getAttribute('aria-invalid')).toBe('false');

  field.flags.invalid = true;
  field.update({ rules: 'min:3' });
  expect(el.getAttribute('aria-required')).toBe('false');
  expect(el.getAttribute('aria-invalid')).toBe('true');
  field.el = null; // headless
  field.updateAriaAttrs();
  
  // unchanged.
  expect(el.getAttribute('aria-required')).toBe('false');
  expect(el.getAttribute('aria-invalid')).toBe('true');
});

test('calls the update method on the validator errors on following updates', () => {
  let el = document.createElement('input');
  const vm = {
    $validator: {
      errors: {
        update: jest.fn()
      }
    }
  };
  const field = new Field(el, { rules: 'required', vm });
  field.update({ rules: 'min:3' });
  expect(vm.$validator.errors.update).toHaveBeenCalledTimes(1);
});

test('validation trigger can validate values directly instead of resolving them', () => {
  document.body.innerHTML = `
    <input name="name" id="name" value="10" type="text">
  `;
  const el = document.querySelector('#name');
  const component = {
    value: 10,
    events: {}, // mocked callback register
    $el: document.body.children[0],
    $watch: () => {},
    $on: jest.fn((event, callback) => {
      component.events[event] = callback;
    })
  };

  const field = new Field(el, {
    rules: 'required',
    component,
    getter: () => el.value,
    vm: {
      $validator: { validate: jest.fn() },
      $el: document.body
    }
  });

  // trigger input event.
  component.events.input('some val');
  expect(field.vm.$validator.validate).toHaveBeenCalledWith(`#${field.id}`, 'some val');
});


describe('fields can track their dependencies', () => {
  test('native input depencies', () => {
    document.body.innerHTML = `
      <input name="other" id="name" value="10" type="text">
    `;
    let field = new Field(null, {
      rules: 'required|confirmed:other',
      vm: {
        $el: document.body,
        $validator: { validate: jest.fn() }
      }
    });
    expect(field.dependencies.length).toBe(1);
    expect(field.dependencies[0].name).toBe('confirmed');
    expect(field.dependencies[0].field.value).toBe('10');
    const destroy = jest.fn();
    field.dependencies[0].field.destroy = destroy;
    field.updateDependencies(); // test destroy.

    expect(destroy).toHaveBeenCalled();
  });

  test('component dependencies', () => {
    const component = {
      value: 10,
      $el: document.body.children[0],
      $watch: () => {},
      $on: () => {}
    };

    const field = new Field(null, {
      rules: 'required|confirmed:$other',
      vm: {
        $el: document.body,
        $refs: {
          other: component
        }
      }
    });

    expect(field.dependencies.length).toBe(1);
    expect(field.dependencies[0].name).toBe('confirmed');
    expect(field.dependencies[0].field.value).toBe(10);
  });

  test.skip('warns if no dependency was resolved', () => {
    document.body.innerHTML = ``;
    global.console.warn = jest.fn();
    let field = new Field(null, {
      rules: 'required|confirmed:other',
      vm: {
        $el: document.body
      }
    });

    expect(global.console.warn).toHaveBeenCalledWith(`[vee-validate] Could not find a field with this selector: "other".`)
  });

  test('validation triggers on the parent/controller field', () => {
    document.body.innerHTML = `
      <input name="other" id="name" value="10" type="text">
    `;
    const el = document.querySelector('#name');
    const field = new Field(null, {
      rules: 'required|confirmed:other',
      vm: {
        $el: document.body,
        $validator: { validate: jest.fn() }
      }
    });

    el.dispatchEvent(new Event('input'));
    expect(field.dependencies[0].field.validator.validate).toHaveBeenCalledWith(`#${field.id}`);
  });
});