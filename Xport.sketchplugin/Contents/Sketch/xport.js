@import 'common.js'

iconName = "icon.png"
pluginDomain = "com.silverux.sketchplugins.xport";
pluginName = "Xport"

var presets = {
	projectPath: '',
	originalScaleIndex: 0,
	groupName: '',
	lastTargetPath: '',
	exportTo1x:1,
	exportTo2x:1,
	exportTo3x:1
}
var userDefaults = initDefaults(presets)
var fileManager = [NSFileManager defaultManager]

var showProjectSelectionDialog = function() {
	
	authorizeHomeFolder(selectXcodeProjectPath)
}

var showExportDialog = function() {
	
	if (selectionIsEmpty()) {
		showDialog("Select one or more Layers or Groups to export.")
		return
	}

	authorizeHomeFolder(exportSelectedLayersToXcode)
}

var showPaddingDialog = function() {
	if (selectionIsEmpty()) {
		showDialog("Select one or more Layers or Groups to export.")
		return
	}

	// select save destination
	var savePanel = [NSSavePanel savePanel]
	[savePanel setAllowsOtherFileTypes:false]
	[savePanel setExtensionHidden:false]
	[savePanel setCanCreateDirectories:true]
	[savePanel setNameFieldStringValue:[[selection firstObject] name]]
	[savePanel setTitle:"Export Selection with Padding"]

	var paddingAccessoryView = [[NSView alloc] initWithFrame:CGRectMake(0,0,130,50)]
	var paddingLabel = [[NSTextField alloc] initWithFrame:CGRectMake(0,12,74,23)]
	[paddingLabel setDrawsBackground:false]
	[paddingLabel setBordered:false]
	[paddingLabel setStringValue:"Padding:"]
	[paddingLabel setAlignment:NSRightTextAlignment]

	[paddingLabel setEditable:false]
	var paddingTextfield = [[NSTextField alloc] initWithFrame:CGRectMake(80,14,50,23)]
	[paddingTextfield setStringValue:"10 px"]
	[paddingAccessoryView addSubview:paddingLabel]
	[paddingAccessoryView addSubview:paddingTextfield]
	[savePanel setAccessoryView:paddingAccessoryView]

	var response = [savePanel runModal]
	if (response == NSOKButton) {

		var saveToFolder = [[[savePanel URL] path] stringByDeletingLastPathComponent],
			padding = parseFloat([paddingTextfield stringValue]),
			loop = [selection objectEnumerator],
			layer, ogLayer, exportSize, rect, finalRect, slice, path;

		while (ogLayer = [loop nextObject]) {
			layer = [ogLayer duplicate]
			[[[layer exportOptions] sizes] removeAllObjects];
			[[layer exportOptions] addExportSize];

			exportSize = [[[[layer exportOptions] sizes] array] lastObject]
			rect = [[layer absoluteRect] rect]

			exportSize.scale = 1;
			exportSize.name = "";
			exportSize.format = "png";
			
			finalRect = CGRectInset(rect, -padding, -padding);
			slice = [MSSliceMaker sliceFromExportSize:exportSize layer:layer inRect:finalRect];

			path = [[saveToFolder stringByAppendingPathComponent:[ogLayer name]] stringByAppendingPathExtension:"png"]
			[doc saveArtboardOrSlice:slice toFile: path];

			[layer removeFromParent]
		}

		var numLayers = [selection count]
		[doc showMessage:(numLayers + " images exported.")]
	}
}

var exportSelectedLayersToXcode = function() {

	var pathString = userDefaults.projectPath;

	if (pathString == "" || ![fileManager fileExistsAtPath:pathString]) {
		selectXcodeProjectPath(exportSelectedLayersToXcode)
		return
	}

	var alert = createAlertBase(false);

	[alert addButtonWithTitle: 'Export'];
	[alert addButtonWithTitle: 'Cancel'];

	[alert addButtonWithTitle: 'Change Project'];

	[alert setMessageText: "Export Settings"]
	var informativeText = "Project path: " + pathString
	[alert setInformativeText: informativeText]
	
	// resolve project folder path
	var projectExtension = [pathString pathExtension]
	if (projectExtension == "xcodeproj" || projectExtension == "xcworkspace") {
		pathString = [pathString stringByDeletingLastPathComponent]
	}

	// gather nested xcassets folders
	var folders = [fileManager enumeratorAtPath:pathString];
	var targetPaths = [NSArray array];
	var targetNames = [NSArray array];
	var availableGroups = [NSArray new];
	var assetsFolder, targetPath, imageGroups, imagesBundlePath,
		imageGroupPredicate = NSPredicate.predicateWithFormat("(pathExtension == '') && (NOT SELF BEGINSWITH '.')");

	while (assetsFolder = [folders nextObject]) {
		if ([assetsFolder pathExtension] == "xcassets") {
			targetPath = pathString + "/" + assetsFolder
			imagesBundlePath = [[NSBundle bundleWithPath:targetPath] bundlePath]
			targetPaths = [targetPaths arrayByAddingObject:targetPath]
			targetNames = [targetNames arrayByAddingObject:[[assetsFolder stringByDeletingLastPathComponent] lastPathComponent]]
			imageGroups = [fileManager contentsOfDirectoryAtPath:imagesBundlePath error:nil]
			if (imageGroups != nil) {
				imageGroups = [imageGroups filteredArrayUsingPredicate:imageGroupPredicate]
				availableGroups = [availableGroups arrayByAddingObjectsFromArray:imageGroups]
			}
		}
	}

	// Target
	[alert addTextLabelWithValue: "Target:"]
	var lastTargetPath = userDefaults.lastTargetPath,
		lastTargetPathIndex = [targetPaths indexOfObject:lastTargetPath];
		lastTargetPathIndex = lastTargetPathIndex == -1 ? 0 : lastTargetPathIndex

	var targetDropdown = createDropDown(targetNames, lastTargetPathIndex)
	[alert addAccessoryView: targetDropdown]

	// Add to group
	[alert addTextLabelWithValue: 'Add imagesets to group (Ex: icons, buttons, etc):']
	var orderedSet = [NSOrderedSet orderedSetWithArray:availableGroups],
		groupOptions = [availableGroups count] == 0 ? [NSArray arrayWithObject:""] : [orderedSet array],
		lastGroupName = userDefaults.groupName,
		lastGroupNameIndex = [groupOptions containsObject:lastGroupName] ? [groupOptions indexOfObject:lastGroupName] : 0,
		groupNamesSelector = createSelect(groupOptions, lastGroupNameIndex)
	[alert addAccessoryView: groupNamesSelector]

	// Separator
	[alert addAccessoryView: createSeparator()]

	// Original Scale
	[alert addTextLabelWithValue: 'Original scale:']
	var scaleOptions = ['1x', '2x'],
		originalScaleIndex = userDefaults.originalScaleIndex,
		scaleDropdown = createDropDown(scaleOptions, originalScaleIndex, 60)
	[alert addAccessoryView: scaleDropdown]

	// Export to sizes
	[alert addTextLabelWithValue: 'Export to sizes:']
	var exportScaleOptions = ['1x', '2x', '3x'],
		indicesOfLastScaleOptions = [];

	if (userDefaults.exportTo1x == 1) { indicesOfLastScaleOptions.push(0) }
	if (userDefaults.exportTo2x == 1) { indicesOfLastScaleOptions.push(1) }
	if (userDefaults.exportTo3x == 1) { indicesOfLastScaleOptions.push(2) }

	var checkboxes = createButtonMatrix(NSSwitchButton, exportScaleOptions, 1, exportScaleOptions.length, "Export to sizes", indicesOfLastScaleOptions, true)
	[alert addAccessoryView: checkboxes]

	var response = [alert runModal]
	if (response != "1001") {

		// Save defaults
		userDefaults.exportTo1x = 0
		userDefaults.exportTo2x = 0
		userDefaults.exportTo3x = 0

		var allCells = [checkboxes cells],
			loopCells = [allCells objectEnumerator],
			cell;
		while (cell = [loopCells nextObject]) {
			if([cell state] == NSOnState) {
				if([cell tag] == 100) {
					userDefaults.exportTo1x = 1
				} else if([cell tag] == 101) {
					userDefaults.exportTo2x = 1
				} else if([cell tag] == 102) {
					userDefaults.exportTo3x = 1
				}
			}
		}

		userDefaults.lastTargetPath = [targetPaths objectAtIndex:[targetDropdown indexOfSelectedItem]]
		userDefaults.originalScaleIndex = [scaleDropdown indexOfSelectedItem]
		userDefaults.groupName = [groupNamesSelector stringValue]
		saveDefaults(userDefaults)

		if (response == "1000") {
			runExportScript()
		} else if (response == "1002") {
			selectXcodeProjectPath(exportSelectedLayersToXcode)
		}
	}

	folders 			= nil
	fileManager 		= nil
	targetPaths 		= nil
	targetNames 		= nil
	availableGroups 	= nil
}

var runExportScript = function() {
	
	var suffixes = []
	if (userDefaults.exportTo1x == 1) suffixes.push('1x')
	if (userDefaults.exportTo2x == 1) suffixes.push('2x')
	if (userDefaults.exportTo3x == 1) suffixes.push('3x')

	var numSuffixes = suffixes.length
	if (numSuffixes == 0) {
		showDialog("You must select at least one export size!", "Export failed.")
		return
	}

	var loop = [selection objectEnumerator],
		folderPath = userDefaults.lastTargetPath,
		originalScale = userDefaults.originalScaleIndex + 1,
		suffix,
		fileName, 
		finalFileName, 
		imageSetPath, 
		filePath, 
		imageContent, 
		imageObj, 
		atSuffix, 
		jsonString,
		layer;

	if (userDefaults.groupName != '') folderPath += "/" + userDefaults.groupName

	while (layer = [loop nextObject]) {

		fileName = sanitizeFilename([layer name])
		imageSetPath = folderPath + "/" + fileName + ".imageset"


		if (createFolderAtPath(imageSetPath)) {

			var imagesArray = [];

			for (var i = 0; i<numSuffixes; i++) {
				suffix = suffixes[i]
				atSuffix = (suffix == '1x') ? "" : "@"+suffix
				finalFileName = fileName + atSuffix + ".png"
				filePath = imageSetPath + "/" + finalFileName

				log("Save image to: " + filePath)

				// export based on original scale
				exportLayerToPath(layer, filePath, parseFloat(suffix)/originalScale)

				imageObj = {
					idiom : "universal",
					scale : suffix,
					filename : finalFileName
				}
				imagesArray.push(imageObj)
			}

			imageContent = {
				info : {
					version : 1,
					author : "silver-ux"
				},
				images : imagesArray
			}

			filePath = imageSetPath + "/Contents.json"
			jsonString = stringify(imageContent, true)	
			writeTextToFile(jsonString, filePath)
		}

	}
}

var sanitizeFilename = function(layerName) {
	var charsToRemove = [NSCharacterSet characterSetWithCharactersInString:"/\\?%*|<>:' ,"]
	var quotesToRemove = [NSCharacterSet characterSetWithCharactersInString:'"']
	var dotsToRemove = [NSCharacterSet characterSetWithCharactersInString:"."]
	var cleanFilename = [[layerName componentsSeparatedByCharactersInSet:charsToRemove] componentsJoinedByString:""]
	cleanFilename = [[cleanFilename componentsSeparatedByCharactersInSet:quotesToRemove] componentsJoinedByString:""];
	return [cleanFilename stringByTrimmingCharactersInSet:dotsToRemove]
}

var selectXcodeProjectPath = function(callbackMethod) {

	var alert = createAlertBase(false);
	[alert addButtonWithTitle: 'Save'];
	[alert addButtonWithTitle: 'Cancel'];


	var existingPath = userDefaults.projectPath, 
		pathField;

	if(existingPath == "") {
		[alert setMessageText: "Select an Xcode Project or Workspace"]
		[alert setInformativeText: "Drop your Project or Workspace file here"]
		[alert addTextFieldWithValue: ""] // 0
		pathField = elementAtIndex(alert, 0)
	} else {
		[alert setMessageText: "Change Xcode Project or Workspace"]
		var informativeText = "Current Project Path: " + existingPath
		[alert setInformativeText: informativeText]
		[alert addTextLabelWithValue: "Drop another Project or Workspace file here"] // 0
		[alert addTextFieldWithValue: ""] // 1
		pathField = elementAtIndex(alert, 1)
	}

	[pathField setFrame:NSMakeRect(0,0,300,60)]
	[pathField setDrawsBackground:false]
	[pathField setBordered:true]

	if ([alert runModal] == "1000") {

		userDefaults.projectPath = [pathField stringValue]
		saveDefaults(userDefaults)

		if(typeof callbackMethod !== 'undefined' && typeof callbackMethod !== 'boolean') {
			callbackMethod()
		}
	}
}