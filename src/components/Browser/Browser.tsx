import produce from 'immer'
import React, {Ref, useRef, useState, useEffect} from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import {ListOnItemsRenderedProps, GridOnItemsRenderedProps} from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
import useDeepCompareEffect from 'use-deep-compare-effect'

import {useAssetBrowserActions} from '../../contexts/AssetBrowserDispatchContext'
import {useAssetBrowserState} from '../../contexts/AssetBrowserStateContext'
import {ORDERS, VIEWS, getFilters} from '../../config'
import Box from '../../styled/Box'
import {Asset, BrowserQueryOptions, BrowserView, Document, Filter} from '../../types'
import Footer from '../Footer/Footer'
import Header from '../Header/Header'
import CardView from '../View/Card'
import TableView from '../View/Table'

const PER_PAGE = 50

type Props = {
  document?: Document
  onClose?: () => void
  selectedAssets?: Asset[]
}

type InfiniteLoaderRenderProps = {
  onItemsRendered: (props: ListOnItemsRenderedProps) => any
  ref: Ref<any>
}

const Browser = (props: Props) => {
  const {document: currentDocument, onClose, selectedAssets} = props

  // Get available filters, depending on whether the `document` prop is available or not.
  const filters: Filter[] = getFilters(currentDocument)

  // Ref used to scroll to the top of the page on filter changes
  const viewRef = useRef<HTMLDivElement | null>(null)

  const {onFetch} = useAssetBrowserActions()
  const {
    fetchCount,
    fetching,
    items
    // totalCount
  } = useAssetBrowserState()
  const [browserQueryOptions, setBrowserQueryOptions] = useState<BrowserQueryOptions>({
    filter: filters[0],
    order: ORDERS[0],
    pageIndex: 0,
    replaceOnFetch: false
  })
  const [browserView, setBrowserView] = useState<BrowserView>(VIEWS[0])

  // const hasFetchedOnce = totalCount >= 0
  const hasFetchedOnce = fetchCount >= 0
  const hasItems = items.length > 0
  const picked = items.filter(item => item.picked)
  const hasPicked = picked.length > 0

  const fetchPage = (index: number, replace: boolean) => {
    const {filter, order} = browserQueryOptions

    const start = index * PER_PAGE
    const end = start + PER_PAGE

    const sort = `order(${order.value})`
    const selector = `[${start}...${end}]`

    // ID can be null when operating on pristine / unsaved drafts
    const currentDocumentId = currentDocument?._id

    onFetch({
      filter: filter.value,
      ...(currentDocumentId ? {params: {documentId: currentDocumentId}} : {}),
      projections: `{
        _id,
        _updatedAt,
        extension,
        metadata {
          dimensions,
          isOpaque,
        },
        originalFilename,
        size,
        url
      }`,
      replace,
      selector,
      sort
    })
  }

  const scrollToTop = () => {
    const viewEl = viewRef && viewRef.current
    if (viewEl) {
      viewEl.scrollTo(0, 0)
    }
  }

  // Fetch items on mount and when query options have changed
  useDeepCompareEffect(() => {
    const {pageIndex, replaceOnFetch} = browserQueryOptions

    fetchPage(pageIndex, replaceOnFetch)

    // Scroll to top when replacing items
    if (replaceOnFetch) {
      scrollToTop()
    }
  }, [browserQueryOptions])

  // Scroll to top when browser view has changed
  useEffect(() => {
    scrollToTop()
  }, [browserView])

  // NOTE: The below is a workaround and can be inaccurate in certain cases.
  // e.g. if PER_PAGE is 10 and you have fetched 10 items, `hasMore` will still be true
  // and another fetch will invoked on next page (which will return 0 items).
  // This is currently how the default asset source in Sanity works.
  // TODO: When it's performant enough to get total asset count across large datasets, revert
  // to using `totalCount` across the board.
  const hasMore = fetchCount === PER_PAGE
  // const hasMore = (browserQueryOptions.pageIndex + 1) * PER_PAGE < totalCount

  const handleFetchNextPage = () => {
    setBrowserQueryOptions(
      produce(draft => {
        draft.pageIndex += 1
        draft.replaceOnFetch = false
      })
    )
  }

  const handleUpdateBrowserQueryOptions = (field: string, value: Record<string, any>) => {
    setBrowserQueryOptions(
      produce(draft => {
        draft[field] = value
        draft.pageIndex = 0
        draft.replaceOnFetch = true
      })
    )
  }

  const handleUpdateBrowserView = (view: BrowserView) => {
    setBrowserView(view)
  }

  // Every row is loaded except for our loading indicator row.
  const isItemLoaded = (index: number) => {
    return index < items.length
  }

  // Only load 1 page of items at a time.
  // Pass an empty callback to InfiniteLoader in case it asks us to load more than once.
  const handleLoadMoreItems = () => {
    if (!fetching) {
      handleFetchNextPage()
    }
    return new Promise(() => {})
  }

  // If there are more items to be loaded then add an extra placeholder row to trigger additional page loads.
  const itemCount = hasMore ? items.length + 1 : items.length

  return (
    <Box bg="darkerGray" fontSize={1} justifyContent="space-between" minHeight="100%">
      {/* Header */}
      <Header
        browserQueryOptions={browserQueryOptions}
        browserView={browserView}
        currentDocument={currentDocument}
        filters={filters}
        items={items}
        onClose={onClose}
        onUpdateBrowserQueryOptions={handleUpdateBrowserQueryOptions}
        onUpdateBrowserView={handleUpdateBrowserView}
      />

      {/* Items */}
      <Box
        bottom={[hasPicked ? 'headerHeight.0' : 0, hasPicked ? 'headerHeight.1' : 0]}
        mx="auto"
        overflow="hidden"
        position="absolute"
        ref={viewRef}
        top={[currentDocument ? 'headerHeight.0' : 'headerHeight.1', 'headerHeight.1']}
        width="100%"
      >
        {hasItems && (browserView.value === 'grid' || 'table') && (
          <AutoSizer>
            {({height, width}) => {
              return (
                <InfiniteLoader
                  isItemLoaded={isItemLoaded}
                  itemCount={itemCount}
                  loadMoreItems={handleLoadMoreItems}
                >
                  {({onItemsRendered, ref}: InfiniteLoaderRenderProps) => {
                    // View: Table
                    if (browserView.value === 'table') {
                      return (
                        <TableView
                          height={height}
                          items={items}
                          itemCount={itemCount}
                          onItemsRendered={onItemsRendered}
                          ref={ref}
                          selectedAssets={selectedAssets}
                          width={width}
                        />
                      )
                    }

                    // View: Grid
                    if (browserView.value === 'grid') {
                      // The `onItemsRendered` method signature for `react-window` grids is different and
                      // requires an adaptor, below.
                      // Source: https://github.com/bvaughn/react-window-infinite-loader/issues/3
                      const newItemsRendered = (gridData: GridOnItemsRenderedProps) => {
                        const {
                          overscanRowStartIndex,
                          overscanRowStopIndex,
                          overscanColumnStopIndex
                        } = gridData

                        const endCol = overscanColumnStopIndex + 1
                        const startRow = overscanRowStartIndex
                        const endRow = overscanRowStopIndex
                        const visibleStartIndex = startRow * endCol
                        const visibleStopIndex = endRow * endCol

                        onItemsRendered({
                          overscanStartIndex: visibleStartIndex - 10,
                          overscanStopIndex: visibleStopIndex + 10,
                          visibleStartIndex,
                          visibleStopIndex
                        })
                      }

                      return (
                        <CardView
                          height={height}
                          items={items}
                          itemCount={itemCount}
                          onItemsRendered={newItemsRendered}
                          ref={ref}
                          selectedAssets={selectedAssets}
                          width={width}
                        />
                      )
                    }
                  }}
                </InfiniteLoader>
              )
            }}
          </AutoSizer>
        )}

        {/* No results */}
        {!hasItems && hasFetchedOnce && !fetching && (
          <Box color="lighterGray" fontSize={1} p={3}>
            No results for the current query
          </Box>
        )}
      </Box>

      {/* Footer */}
      {hasPicked && <Footer />}
    </Box>
  )
}

export default Browser
