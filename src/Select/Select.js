// Copyright 2019 Esri
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.​

import React, { Component, Children } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import Downshift from 'downshift';
import memoize from 'memoize-one';
import { List } from 'react-virtualized';
import { Manager, Reference, Popper } from 'react-popper';
import matchSorter from 'match-sorter';
import { rtlPlacement } from '../utils/helpers';

import {
  StyledSelectWrapper,
  StyledSelectButton,
  StyledSelectInput,
  PopperManagerStyles
} from './Select-styled';

import SelectMenu from './SelectMenu';
import { FormControlContext } from '../Form/FormControl';
import { PopoverContext } from '../Popover/Popover';

class Select extends Component {
  getAnchorElement = ({
    ref,
    getToggleButtonProps,
    getInputProps,
    openMenu,
    highlightedIndex,
    selectHighlightedItem,
    inputValue,
    getItemProps,
    menuHeight,
    selectedItem,
    ...other
  }) => {
    const {
      renderValue,
      filterable,
      autoSelect,
      fullWidth,
      minimal,
      style,
      id,
      placeholder,
      disabled,
      field,
      form
    } = this.props;

    const onKeyDown = event => {
      if (!event) return;
      if (event.key === 'Enter') {
        if (filterable) {
          event.preventDefault();
        }
      } else if (event.key === ' ') {
        if (filterable && autoSelect) return;

        if (highlightedIndex === null) {
          openMenu();
        } else {
          event.nativeEvent.preventDefault(); // Avoids an extra space after value
          selectHighlightedItem();
        }
      }
    };

    if (filterable) {
      return (
        <FormControlContext.Consumer>
          {formControlContext => (
            <StyledSelectInput
              as="input"
              onClick={e => {
                e.target.select(0, e.target.value.length);
                getToggleButtonProps().onClick(e);
              }}
              success={this.isSuccess({ formControlContext, field, form })}
              error={this.isError({ formControlContext, field, form })}
              disabled={this.isDisabled({ field, form, disabled })}
              {...getInputProps({
                placeholder,
                id: id || formControlContext._generatedId,
                fullWidth,
                minimal,
                style,
                onKeyDown,
                onBlur: this.handleBlur,
                ...other
              })}
              ref={ref}
            />
          )}
        </FormControlContext.Consumer>
      );
    }
    return (
      <FormControlContext.Consumer>
        {formControlContext => (
          <StyledSelectButton
            {...getToggleButtonProps()}
            {...getInputProps({
              onKeyDown,
              onBlur: this.handleBlur
            })}
            as="button"
            fullWidth={fullWidth}
            minimal={minimal}
            ref={ref}
            id={id || formControlContext._generatedId}
            style={style}
            success={this.isSuccess({ formControlContext, field, form })}
            error={this.isError({ formControlContext, field, form })}
            disabled={this.isDisabled({ field, form, disabled })}
            {...other}
          >
            {this.downshiftRenderValue({ selectedItem, renderValue })
              ? this.downshiftRenderValue({ selectedItem, renderValue })
              : placeholder}
          </StyledSelectButton>
        )}
      </FormControlContext.Consumer>
    );
  };

  downshiftRenderValue = ({ selectedItem, renderValue }) => {
    if (renderValue) return renderValue(selectedItem);

    return this.itemToString(selectedItem);
  };

  itemToString = item => {
    let label = item;
    if (item && item.props) {
      label = item.props.label || item.props.children || item;
    }

    return label;
  };

  downshiftOnChange = params => {
    const { selectedItem, field, form, onChange } = params;
    // Ignore onChange if not item was selected (e.g. escape key)
    if (!selectedItem) return;
    let name, touched, setTouched, setFieldValue;
    if (field) {
      name = field.name;
      touched = form.touched;
      setTouched = form.setTouched;
      setFieldValue = form.setFieldValue;
    }

    const value = selectedItem.props.value;

    if (setFieldValue) {
      setTouched({ ...touched, [name]: true });
      setFieldValue(name, value);
    }

    onChange(value, selectedItem);
  };

  _getItemFromValue = (children, value) => {
    if (value === null || value === undefined) return null;

    return (
      Children.toArray(children).filter(child => {
        return child.props.value === value;
      })[0] || null
    );
  };

  handleBlur = e => {
    const { onBlur, field, autoSelect } = this.props;

    // Ignore field blur if autoSelect
    // Blur behavior is handled by downshift stateReducer
    if (!autoSelect && field) {
      field.onBlur(e);
    }

    onBlur(e);
  };

  getMenuItems = (filteredList, virtualized, params) => {
    const {
      getItemProps,
      highlightedIndex,
      selectedItem,
      menuHeight,
      virtualizedRowHeight,
      virtualizedMenuWidth
    } = params;

    if (virtualized) {
      return (
        <List
          width={virtualizedMenuWidth || 9999}
          autoWidth={!virtualizedMenuWidth}
          scrollToIndex={highlightedIndex || 0}
          scrollToAlignment="auto"
          height={
            filteredList.length < 7
              ? filteredList.length * virtualizedRowHeight
              : menuHeight
          }
          rowCount={filteredList.length}
          rowHeight={virtualizedRowHeight}
          rowRenderer={({ index, style: rowRenderStyle }) => {
            return this.getMenuItem(filteredList[index], {
              getItemProps,
              highlightedIndex,
              index,
              selectedItem,
              rowRenderStyle
            });
          }}
          style={{
            direction: (document && document.documentElement.dir) || 'ltr'
          }}
        />
      );
    }

    return filteredList.map((item, index) =>
      this.getMenuItem(item, {
        getItemProps,
        highlightedIndex,
        index,
        selectedItem
      })
    );
  };

  getMenuItem = (item, params) => {
    const {
      getItemProps = props => props,
      highlightedIndex,
      index,
      selectedItem,
      rowRenderStyle
    } = params;

    return React.cloneElement(item, {
      ...getItemProps({
        style: { ...item.props.style, ...rowRenderStyle },
        item,
        index,
        active: highlightedIndex === index,
        selected: selectedItem && selectedItem.props.value === item.props.value,
        key: item.props.value
      })
    });
  };

  filterItems = memoize((items, inputValue, filterable, selectedItem) => {
    const inputMatchesSelection =
      inputValue === this.itemToString(selectedItem);

    if (filterable && inputValue && !inputMatchesSelection) {
      return matchSorter(items || this.state.items, inputValue, {
        keys: ['props.children', 'props.value']
      });
    }

    return items;
  });

  getFullWidthStyle = fullWidth => {
    if (fullWidth) {
      return { minWidth: '100%' };
    }
  };

  getSelectedValue = (field, selectedValue) => {
    return field ? field.value : selectedValue;
  };

  isSuccess = params => {
    const { formControlContext, field, form } = params;
    let name, touched, errors;
    if (field) {
      name = field.name;
      touched = form.touched;
      errors = form.errors;
    }

    if (touched) {
      return touched[name] && !errors[name] ? true : false;
    }
    return formControlContext.success;
  };

  isError = params => {
    const { formControlContext, field, form } = params;
    let name, touched, errors;
    if (field) {
      name = field.name;
      touched = form.touched;
      errors = form.errors;
    }

    if (touched) {
      return touched[name] && errors[name] ? true : false;
    }
    return formControlContext.error;
  };

  isDisabled = params => {
    const { field, form, disabled } = params;
    let isSubmitting;
    if (field) {
      isSubmitting = form.isSubmitting;
    }

    return isSubmitting || disabled;
  };

  _getPopper = params => {
    const { popper, isOpen, isInPopover, appendToBody } = params;

    if (isOpen || isInPopover) {
      if (appendToBody) {
        return ReactDOM.createPortal(popper, document.body);
      }

      return popper;
    }
  };

  getItemIndexFromChildren = value => {
    const { children } = this.props;
    return children.findIndex(child => child.props.value === value);
  };

  stateReducer = (state, changes) => {
    if (!this.props.autoSelect) {
      return changes;
    }

    const { children } = this.props;
    let selectedItemIndex;

    switch (changes.type) {
      case Downshift.stateChangeTypes.mouseUp:
      case Downshift.stateChangeTypes.blurInput:
      case Downshift.stateChangeTypes.blurButton:
        // Assumes they already collapsed the select and are now
        // navigating away, we shouldnt change the selection here
        if (!state.isOpen) {
          return changes;
        }

        // Get the item list so we can find the item at the highlitedIndex
        const {
          filterable,
          virtualizedRowHeight,
          virtualizedMenuWidth,
          menuHeight
        } = this.props;
        const filteredItems = this.filterItems(
          children,
          state.inputValue,
          filterable,
          state.selectedItem
        );
        const items = this.getMenuItems(filteredItems, false, {
          highlightedIndex: state.highlightedIndex,
          menuHeight,
          virtualizedRowHeight,
          virtualizedMenuWidth
        });
        const selectedItem = items[state.highlightedIndex];

        selectedItemIndex =
          selectedItem &&
          this.getItemIndexFromChildren(selectedItem.props.value);

        // Set the new selectedItem
        return {
          ...changes,
          highlightedIndex: selectedItemIndex,
          selectedItem
        };
      case Downshift.stateChangeTypes.changeInput:
        return { ...changes, highlightedIndex: 0 };
      case Downshift.stateChangeTypes.clickItem:
      case Downshift.stateChangeTypes.keyDownEnter:
        selectedItemIndex =
          changes.selectedItem &&
          this.getItemIndexFromChildren(changes.selectedItem.props.value);

        return {
          ...changes,
          highlightedIndex: selectedItemIndex || changes.highlightedIndex
        };
      default:
        return changes;
    }
  };

  render() {
    const {
      children,
      filterable,
      virtualized,
      fullWidth,
      minimal,
      style,
      id,
      placeholder,
      selectedItem,
      selectedValue,
      menuStyle,
      wrapperStyle,
      horizontal,
      label,
      onChange,
      positionFixed,
      appendToBody,
      disabled,
      onBlur,
      field,
      form,
      virtualizedRowHeight,
      virtualizedMenuWidth,
      autoSelect,
      popperModifiers,
      ...other
    } = this.props;

    const menuHeight =
      (menuStyle && parseInt(menuStyle.height, 10)) ||
      (menuStyle && parseInt(menuStyle.maxHeight, 10)) ||
      300;

    // The selectedItem or the item with the same value as selectedValue
    const selectedMenuItem =
      selectedItem ||
      this._getItemFromValue(
        children,
        this.getSelectedValue(field, selectedValue)
      );

    let defaultHighlightedIndex = undefined;
    if (autoSelect) {
      if (selectedMenuItem) {
        defaultHighlightedIndex = this.getItemIndexFromChildren(
          selectedMenuItem.props.value
        );
      } else {
        defaultHighlightedIndex = 0;
      }
    }

    return (
      <Manager style={{ ...PopperManagerStyles, ...wrapperStyle }}>
        <Downshift
          itemToString={this.itemToString}
          onChange={selection => {
            this.downshiftOnChange({
              selectedItem: selection,
              field,
              form,
              onChange
            });
          }}
          selectedItem={selectedMenuItem}
          stateReducer={this.stateReducer}
          defaultHighlightedIndex={defaultHighlightedIndex}
        >
          {({
            getRootProps,
            getToggleButtonProps,
            getInputProps,
            getItemProps,
            isOpen,
            openMenu,
            selectHighlightedItem,
            selectedItem,
            highlightedIndex,
            inputValue
          }) => {
            const filteredList = this.filterItems(
              children,
              inputValue,
              filterable,
              selectedItem
            );

            return (
              <StyledSelectWrapper
                fullWidth={fullWidth}
                {...getRootProps({}, { suppressRefError: true })}
              >
                <Reference style={{ display: 'inline-block' }}>
                  {({ ref }) => {
                    return this.getAnchorElement({
                      ref,
                      getToggleButtonProps,
                      getInputProps,
                      openMenu,
                      highlightedIndex,
                      selectHighlightedItem,
                      inputValue,
                      getItemProps,
                      menuHeight,
                      selectedItem,
                      ...other
                    });
                  }}
                </Reference>
                <PopoverContext.Consumer>
                  {popoverContext => {
                    return this._getPopper({
                      popper: (
                        <Popper
                          positionFixed={positionFixed}
                          placement={rtlPlacement(other.placement)}
                          modifiers={{
                            preventOverflow: {
                              boundariesElement:
                                positionFixed || appendToBody
                                  ? 'window'
                                  : 'scrollParent'
                            },
                            ...popperModifiers
                          }}
                        >
                          {({
                            ref,
                            style: popperStyle,
                            placement,
                            scheduleUpdate
                          }) => (
                            <SelectMenu
                              innerRef={ref}
                              style={{
                                ...popperStyle,
                                ...this.getFullWidthStyle(),
                                ...menuStyle
                              }}
                              isOpen={isOpen}
                              data-placement={placement}
                              fullWidth={fullWidth}
                              scheduleUpdate={scheduleUpdate}
                            >
                              {this.getMenuItems(filteredList, virtualized, {
                                highlightedIndex,
                                menuHeight,
                                virtualizedRowHeight,
                                virtualizedMenuWidth,
                                getItemProps,
                                selectedItem
                              })}
                            </SelectMenu>
                          )}
                        </Popper>
                      ),
                      isOpen,
                      popoverContext: popoverContext.isInPopover,
                      appendToBody
                    });
                  }}
                </PopoverContext.Consumer>
              </StyledSelectWrapper>
            );
          }}
        </Downshift>
      </Manager>
    );
  }
}

Select.propTypes = {
  /** Nodes to be used as options in the Select. */
  children: PropTypes.node,
  /** Toggle the Select to use an input and allow filtering of the items. */
  filterable: PropTypes.bool,
  /** The highlighted item will be automatically selected on blur. */
  autoSelect: PropTypes.bool,
  /** Use react-virtualized to render rows as the user scrolls. */
  virtualized: PropTypes.bool,
  /** Callback function fired when the value of the Select changes. */
  onChange: PropTypes.func,
  /** The selected item of the Select. */
  selectedItem: PropTypes.node,
  /** Value of the selected item. */
  selectedValue: PropTypes.any,
  /** Function to run when determining how to display selected values in a collapsed Select. */
  renderValue: PropTypes.func,
  /** Placeholder text for the input. */
  placeholder: PropTypes.string,
  /** Whether or not the Select will fill its container's width. */
  fullWidth: PropTypes.bool,
  /** A style variant for Select inputs. */
  minimal: PropTypes.bool,
  /** HTML prop for the Select; works together with a label's `for` prop. */
  id: PropTypes.string,
  /** Style prop applied to the menu wrapper. */
  menuStyle: PropTypes.object,
  /** Uses `position: fixed` on the tooltip, allowing it to show up outside of containers that have `overflow: hidden`. */
  positionFixed: PropTypes.bool,
  /** Specify where the menu should appear in relation to the Select element. */
  placement: PropTypes.oneOf([
    'auto',
    'top',
    'top-start',
    'top-end',
    'right',
    'right-start',
    'right-end',
    'bottom',
    'bottom-start',
    'bottom-end',
    'left',
    'left-start',
    'left-end'
  ]),
  /** (virtualized only) Row height used to calculate how many rows to render in a virtualized menu. */
  virtualizedRowHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
  /** (virtualized only) Width of the menu; unloaded rows may be wider than the initial set. */
  virtualizedMenuWidth: PropTypes.number,
  /** Modifiers to be passed to the Popper element */
  popperModifiers: PropTypes.object
};

Select.defaultProps = {
  placeholder: 'Select...',
  placement: 'bottom-start',
  virtualizedRowHeight: 42,
  onChange: () => {},
  onBlur: () => {}
};

Select.displayName = 'Select';

export default Select;
