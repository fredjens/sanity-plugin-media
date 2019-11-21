import formatRelative from 'date-fns/formatRelative'
import filesize from 'filesize'
import React from 'react'
import {IoMdCheckmarkCircleOutline, IoIosReturnRight, IoMdClose} from 'react-icons/io'
import Button from 'part:@sanity/components/buttons/default'
import ErrorIcon from 'part:@sanity/base/error-icon'
import LinkIcon from 'part:@sanity/base/link-icon'
import Spinner from 'part:@sanity/components/loading/spinner'

import {useAssetBrowserActions} from '../../contexts/AssetBrowserDispatchContext'
import Checkbox from '../../styled/Checkbox'
import IconButton from '../../styled/IconButton'
import Image from '../../styled/Image'
import Box from '../../styled/Box'
import Row from '../../styled/Row'
import ResponsiveBox from '../ResponsiveBox/ResponsiveBox'
import {Item} from '../../types'
import imageDprUrl from '../../util/imageDprUrl'

type Props = {
  item: Item
  selected: boolean
}

const TableItem = (props: Props) => {
  const {item, selected} = props
  const {
    onDelete,
    onDialogShowConflicts,
    onDialogShowRefs,
    onPick,
    onSelect
  } = useAssetBrowserActions()

  const asset = item?.asset
  const dimensions = item?.asset?.metadata?.dimensions
  const errorCode = item?.errorCode
  const isOpaque = item?.asset?.metadata?.isOpaque
  const picked = item?.picked
  const updating = item?.updating

  // Short circuit if no asset is available
  if (!asset) {
    return null
  }

  const handleCheckboxChange = () => {
    onPick(asset._id, !picked)
  }

  const handleDeleteAsset = () => {
    onDelete(asset)
  }

  const handleDialogConflicts = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDialogShowConflicts(asset)
  }

  const handleSelect = () => {
    onSelect([
      {
        kind: 'assetDocumentId',
        value: asset._id
      }
    ])
  }

  const handleShowRefs = () => {
    onDialogShowRefs(asset)
  }

  return (
    <Row
      bg={picked ? 'whiteOverlay' : 'none'}
      color="gray"
      fontSize={1}
      opacity={updating ? 0.5 : 1}
      userSelect="none"
      whiteSpace="nowrap"
    >
      {/* Checkbox */}
      <Box>
        <Checkbox checked={picked} disabled={updating} onChange={handleCheckboxChange} mx="auto" />
      </Box>

      {/* Preview image + spinner */}
      <Box>
        <ResponsiveBox aspectRatio={4 / 3}>
          <Image
            draggable={false}
            opacity={selected ? 0.15 : 1}
            showCheckerboard={!isOpaque}
            src={imageDprUrl(asset, 100)}
          />

          {/* Selected checkmark */}
          {selected && (
            <Box
              alignItems="center"
              color="white"
              display="flex"
              justifyContent="center"
              left={0}
              position="absolute"
              size="100%"
              top={0}
            >
              <IoMdCheckmarkCircleOutline size={16} />
            </Box>
          )}

          {/* Spinner */}
          {updating && (
            <Box left={0} position="absolute" size="100%" top={0}>
              <Spinner center />
            </Box>
          )}
        </ResponsiveBox>
      </Box>

      {/* Filename */}
      <Box>
        <strong>{asset.originalFilename}</strong>
      </Box>

      {/* Dimensions */}
      <Box>
        {dimensions.width || 'unknown'} x {dimensions.height || 'unknown'} px
      </Box>

      {/* File extension */}
      <Box>{asset.extension.toUpperCase()}</Box>

      {/* Size */}
      <Box>{filesize(asset.size, {round: 0})}</Box>

      {/* Last updated */}
      <Box>{formatRelative(new Date(asset._updatedAt), new Date())}</Box>

      {/* Error */}
      <Box>
        {errorCode && (
          <IconButton color="red" fontSize={3} onClick={handleDialogConflicts}>
            <ErrorIcon />
          </IconButton>
        )}
      </Box>

      {/* Actions */}
      <Box textAlign={['left', 'right']}>
        <Button
          disabled={updating}
          icon={IoIosReturnRight.bind(null, {size: 18})}
          kind="simple"
          onClick={handleSelect}
        />
        <Button
          disabled={updating}
          icon={LinkIcon.bind(null, {size: 16})}
          kind="simple"
          onClick={handleShowRefs}
        />
        <Button
          color="danger"
          disabled={updating}
          icon={IoMdClose.bind(null, {size: 18})}
          kind="simple"
          onClick={handleDeleteAsset}
        />
      </Box>
    </Row>
  )
}

export default TableItem